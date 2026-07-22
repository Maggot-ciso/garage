import { useEffect, useRef, useState } from 'react'
import { Camera, Fuel, NotebookPen, Paperclip, QrCode } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { type LogEntry } from '../../db/db'
import { addEntry, deleteEntry, entriesForCar, updateEntry } from '../../db/entries'
import { resolveActiveCar } from '../../db/activeCar'
import { CarPicker } from '../../components/CarPicker'
import { isAiConfigured } from '../../ai/aiClient'
import { CATEGORY_LABELS, CategoryTag } from '../../components/categoryIcons'
import { scanInvoice, toAutoEntry, type InvoiceFields } from './invoiceScan'
import { isUsable, scanLocally } from './localScan'
import { EntryForm } from './EntryForm'
import { QuickFuelSheet } from './QuickFuelSheet'
import { QrScanSheet } from './QrScanSheet'
import { qrToRequest } from './ekasaQr'
import { fetchReceipt } from './ekasaClient'
import { mapReceipt } from './ekasaMap'
import { AttachmentStrip } from './AttachmentStrip'
import { useEntryAttachments } from './useEntryAttachments'
import { addAttachment, entryIdsWithAttachments } from '../../db/attachments'
import { prepareAttachment } from './imageProcessing'

// A failed attachment must never lose the entry that was already saved, so
// this reports and moves on rather than throwing into the save path.
async function attachScanned(file: File, carId: string, entryId: string) {
  try {
    const prepared = await prepareAttachment(file)
    await addAttachment({ ...prepared, carId, entryId, size: prepared.bytes.byteLength })
  } catch (err) {
    console.warn('Could not keep the scanned file:', err)
  }
}

async function trySave(action: () => Promise<void>) {
  try {
    await action()
  } catch (err) {
    window.alert(`Saving failed: ${err instanceof Error ? err.message : String(err)}`)
  }
}

type View =
  | { mode: 'list' }
  | { mode: 'add'; prefill?: InvoiceFields }
  | { mode: 'quick' }
  | { mode: 'qr-scan' }
  | { mode: 'edit'; entry: LogEntry }

export function LogbookScreen() {
  const [view, setView] = useState<View>({ mode: 'list' })
  const [aiReady, setAiReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const [lastScanned, setLastScanned] = useState<LogEntry | null>(null)
  // Held when a scan falls back to the review form, so the file still lands on
  // the entry the owner ends up saving.
  const [scannedFile, setScannedFile] = useState<File | null>(null)
  const scanInput = useRef<HTMLInputElement>(null)

  const state = useLiveQuery(resolveActiveCar, [])
  const carId = state?.car?.id
  const entries = useLiveQuery(
    () => (carId ? entriesForCar(carId) : Promise.resolve([])),
    [carId],
  )

  // Hooks must run before the early returns below, so the entry id is derived
  // from the view rather than called inside a branch.
  const attachments = useEntryAttachments({
    carId: carId ?? '',
    entryId: view.mode === 'edit' ? view.entry.id : undefined,
  })
  const withAttachments = useLiveQuery(
    () => (carId ? entryIdsWithAttachments(carId) : Promise.resolve(new Set<string>())),
    [carId],
  )

  useEffect(() => {
    void isAiConfigured().then(setAiReady)
  }, [])

  if (state === undefined || entries === undefined) return null
  const { cars, car } = state

  if (cars.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <NotebookPen className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
        <h2 className="text-base font-semibold">No car yet</h2>
        <p className="muted max-w-xs text-sm">
          Add a car in the Garage tab first — logbook entries belong to a car.
        </p>
      </div>
    )
  }

  const latestOdometer = entries.reduce((max, e) => Math.max(max, e.odometer), 0)

  async function handleScan(file: File) {
    if (!carId) return
    setScanning(true)
    setScanMessage(null)
    setLastScanned(null)
    try {
      // Local extraction first — no key, no network, no cost. AI is consulted
      // only when the deterministic path came back with nothing usable.
      const local = await scanLocally(file)
      let fields: InvoiceFields = local.fields
      if (!isUsable(fields) && aiReady) {
        try {
          fields = await scanInvoice(file)
        } catch (err) {
          // A rejected key must not destroy a partial local read
          setScanMessage(err instanceof Error ? err.message : 'AI scan failed.')
        }
      }
      const auto = toAutoEntry(fields, carId, latestOdometer)
      if (auto) {
        const saved = await addEntry(auto)
        // The scanned file IS the receipt — keep it on the entry it produced.
        await attachScanned(file, carId, saved.id)
        setLastScanned(saved)
      } else if (Object.keys(fields).length > 0) {
        setScannedFile(file)
        setView({ mode: 'add', prefill: fields })
        setScanMessage('Could not read everything — check the fields and save.')
      } else {
        setScanMessage(
          aiReady
            ? 'Could not read anything useful from that file.'
            : 'Could not read that PDF. Photos need an API key for now — or enter it by hand.',
        )
      }
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : 'Scan failed.')
    } finally {
      setScanning(false)
    }
  }

  // eKasa QR path: deterministic, no AI, no key, no cost. The decoded string
  // resolves to the full receipt via the Financial Administration API; we prefill
  // the form and let the owner confirm. Any failure falls back to manual entry.
  async function handleQrDecoded(decoded: string) {
    const req = qrToRequest(decoded)
    if (!req) {
      setView({ mode: 'list' })
      setScanMessage("That QR isn't a Slovak eKasa receipt.")
      return
    }
    setScanning(true)
    setScanMessage(null)
    try {
      const receipt = await fetchReceipt(req)
      const { fields } = mapReceipt(receipt)
      setScannedFile(null)
      setView({ mode: 'add', prefill: fields })
      setScanMessage('Read from the eKasa receipt — check the fields and save.')
    } catch (err) {
      setView({ mode: 'list' })
      setScanMessage(
        err instanceof Error ? err.message : 'Could not read that receipt.',
      )
    } finally {
      setScanning(false)
    }
  }

  if (view.mode === 'qr-scan' && carId) {
    return (
      <QrScanSheet
        onScan={(decoded) => void handleQrDecoded(decoded)}
        onCancel={() => setView({ mode: 'list' })}
      />
    )
  }

  if (view.mode === 'quick' && carId) {
    return (
      <QuickFuelSheet
        carId={carId}
        suggestedOdometer={latestOdometer || undefined}
        history={entries.map((e) => ({ date: e.date, odometer: e.odometer }))}
        onSave={(fields) =>
          trySave(async () => {
            await addEntry(fields)
            setView({ mode: 'list' })
          })
        }
        onCancel={() => setView({ mode: 'list' })}
      />
    )
  }

  if (view.mode === 'add' && carId) {
    return (
      <div className="flex flex-col gap-3">
        {scanMessage && view.prefill && <p className="notice-amber">{scanMessage}</p>}
        <EntryForm
          carId={carId}
          prefill={view.prefill}
          suggestedOdometer={latestOdometer || undefined}
          history={entries.map((e) => ({ date: e.date, odometer: e.odometer }))}
          onSave={(fields) =>
            trySave(async () => {
              const saved = await addEntry(fields)
              await attachments.persistTo(saved.id)
              if (scannedFile) {
                await attachScanned(scannedFile, carId, saved.id)
                setScannedFile(null)
              }
              setScanMessage(null)
              setView({ mode: 'list' })
            })
          }
          attachments={
            <AttachmentStrip
              attachments={attachments.attachments}
              busy={attachments.busy}
              onAdd={attachments.add}
              onDelete={attachments.remove}
            />
          }
          onCancel={() => {
            setScanMessage(null)
            setScannedFile(null)
            setView({ mode: 'list' })
          }}
        />
      </div>
    )
  }

  if (view.mode === 'edit' && carId) {
    return (
      <EntryForm
        carId={carId}
        entry={view.entry}
        history={entries
          .filter((e) => e.id !== view.entry.id)
          .map((e) => ({ date: e.date, odometer: e.odometer }))}
        onSave={(fields) =>
          trySave(async () => {
            await updateEntry(view.entry.id, fields)
            setLastScanned(null)
            setView({ mode: 'list' })
          })
        }
        attachments={
          <AttachmentStrip
            attachments={attachments.attachments}
            busy={attachments.busy}
            onAdd={attachments.add}
            onDelete={attachments.remove}
          />
        }
        onCancel={() => setView({ mode: 'list' })}
        onDelete={async () => {
          if (window.confirm('Delete this entry? This cannot be undone.')) {
            await deleteEntry(view.entry.id)
            setLastScanned(null)
            setView({ mode: 'list' })
          }
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <CarPicker cars={cars} car={car} />

      <>
          <input
            ref={scanInput}
            type="file"
            accept={aiReady ? 'image/*,application/pdf' : 'application/pdf'}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleScan(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={scanning}
            onClick={() => scanInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-red-400 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-700 dark:text-red-400"
          >
            <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
            {scanning
              ? 'Reading invoice…'
              : aiReady
                ? 'Scan invoice or receipt (photo / PDF)'
                : 'Scan invoice (PDF)'}
          </button>
          <button
            type="button"
            disabled={scanning}
            onClick={() => setView({ mode: 'qr-scan' })}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white active:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200"
          >
            <QrCode className="h-4 w-4" strokeWidth={2} aria-hidden />
            Scan receipt QR (eKasa)
          </button>
      </>

      {scanMessage && !scanning && <p className="notice-amber">{scanMessage}</p>}

      {lastScanned && (
        <div className="notice-amber flex items-center gap-2">
          <span className="min-w-0 flex-1">
            Saved {CATEGORY_LABELS[lastScanned.category]} · {lastScanned.cost.toFixed(2)} € —
            check it
          </span>
          <button
            type="button"
            onClick={() => setView({ mode: 'edit', entry: lastScanned })}
            className="shrink-0 rounded-lg px-3 py-1.5 font-semibold bg-slate-900 text-white active:bg-slate-800 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200"
          >
            Review
          </button>
          <button
            type="button"
            onClick={async () => {
              await deleteEntry(lastScanned.id)
              setLastScanned(null)
            }}
            className="shrink-0 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            Undo
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <Fuel className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
          <h2 className="text-base font-semibold">No entries yet</h2>
          <p className="muted max-w-xs text-sm">
            Log a fill-up or a garage visit — it takes a few seconds.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => setView({ mode: 'edit', entry })}
                className="card-tap w-full p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 truncate font-medium">
                    <CategoryTag category={entry.category} />
                    {entry.needsReview && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        check
                      </span>
                    )}
                    {withAttachments?.has(entry.id) && (
                      <Paperclip
                        className="muted h-3.5 w-3.5 shrink-0"
                        strokeWidth={2}
                        aria-label="Has an attachment"
                      />
                    )}
                  </span>
                  <span className="shrink-0 font-semibold">{entry.cost.toFixed(2)} €</span>
                </div>
                <div className="muted mt-0.5 flex items-baseline justify-between text-sm">
                  <span>
                    {entry.date} · {entry.odometer.toLocaleString()} km
                  </span>
                  {entry.category === 'fuel' && entry.litres !== undefined && (
                    <span>
                      {entry.litres} L{entry.fullTank ? '' : ' (partial)'}
                    </span>
                  )}
                </div>
                {entry.notes && <div className="faint mt-0.5 truncate text-sm">{entry.notes}</div>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => setView({ mode: 'quick' })}
        className="btn-primary flex items-center justify-center gap-2"
      >
        <Fuel className="h-5 w-5" strokeWidth={2} aria-hidden /> Quick fill-up
      </button>
      <button
        type="button"
        onClick={() => setView({ mode: 'add' })}
        className="btn-secondary"
      >
        Add entry
      </button>
    </div>
  )
}
