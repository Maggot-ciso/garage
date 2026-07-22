import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { ENTRY_CATEGORIES, type EntryCategory, type LogEntry } from '../../db/db'
import type { EntryFields } from '../../db/entries'
import { isAiConfigured } from '../../ai/aiClient'
import { CATEGORY_ICONS, CATEGORY_LABELS, categoryKey } from '../../components/categoryIcons'
import { useT } from '../../i18n/I18nProvider'
import { scanReceipt } from './receiptScan'
import type { InvoiceFields } from './invoiceScan'
import {
  odometerWarning,
  validateEntry,
  type EntryFormErrors,
  type EntryFormValues,
} from './entryValidation'

export { CATEGORY_LABELS }

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function EntryForm({
  carId,
  entry,
  prefill,
  suggestedOdometer,
  history,
  attachments,
  onSave,
  onCancel,
  onDelete,
}: {
  carId: string
  entry?: LogEntry
  // Partial values from an invoice scan that couldn't auto-save (add mode only)
  prefill?: InvoiceFields
  suggestedOdometer?: number
  /** Other entries for this car, so a mistyped odometer can be spotted */
  history?: { date: string; odometer: number }[]
  attachments?: React.ReactNode
  onSave: (fields: EntryFields) => void
  onCancel: () => void
  onDelete?: () => void
}) {
  const [category, setCategory] = useState<EntryCategory>(
    entry?.category ?? prefill?.category ?? 'fuel',
  )
  const [values, setValues] = useState<EntryFormValues>({
    date: entry?.date ?? prefill?.date ?? today(),
    odometer: entry
      ? String(entry.odometer)
      : prefill?.odometer !== undefined
        ? String(prefill.odometer)
        : '',
    cost: entry ? String(entry.cost) : prefill?.cost !== undefined ? String(prefill.cost) : '',
    litres:
      entry?.litres !== undefined
        ? String(entry.litres)
        : prefill?.litres !== undefined
          ? String(prefill.litres)
          : '',
    fullTank: entry?.fullTank ?? true,
    company: entry?.company ?? prefill?.company ?? '',
    items: (entry?.items ?? prefill?.items ?? []).map((i) => ({
      name: i.name,
      price: String(i.price),
    })),
    notes: entry?.notes ?? prefill?.notes ?? '',
  })
  const [errors, setErrors] = useState<EntryFormErrors>({})
  const t = useT()

  const odometerNote =
    history && values.odometer.trim()
      ? odometerWarning(
          { date: values.date, odometer: Number(values.odometer.trim()) },
          history,
        )
      : null
  const [aiReady, setAiReady] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanMessage, setScanMessage] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void isAiConfigured().then(setAiReady)
  }, [])

  const isFuel = category === 'fuel'

  function set<K extends keyof EntryFormValues>(key: K, value: EntryFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }))
  }

  function setItem(index: number, patch: Partial<{ name: string; price: string }>) {
    setValues((v) => ({
      ...v,
      items: v.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }))
  }

  function addItem() {
    setValues((v) => ({ ...v, items: [...v.items, { name: '', price: '' }] }))
  }

  function removeItem(index: number) {
    setValues((v) => ({ ...v, items: v.items.filter((_, i) => i !== index) }))
  }

  // Shown under the table so a mistyped line is obvious against the receipt
  // total. Never auto-corrects `cost` — the receipt total is authoritative
  // (discounts mean the lines legitimately differ).
  const itemsTotal = values.items.reduce((sum, i) => {
    const n = Number(i.price.trim().replace(',', '.'))
    return sum + (Number.isFinite(n) ? n : 0)
  }, 0)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = validateEntry(values, carId, category)
    setErrors(result.errors)
    if (result.fields) onSave(result.fields)
  }

  async function handleReceipt(file: File) {
    setScanning(true)
    setScanMessage(null)
    try {
      const fields = await scanReceipt(file)
      const found = Object.keys(fields).length
      setValues((v) => ({
        ...v,
        ...(fields.date ? { date: fields.date } : {}),
        ...(fields.cost !== undefined ? { cost: String(fields.cost) } : {}),
        ...(fields.litres !== undefined ? { litres: String(fields.litres) } : {}),
        ...(fields.odometer !== undefined ? { odometer: String(fields.odometer) } : {}),
      }))
      setScanMessage(found > 0 ? t('entry.scanFilled', { n: found }) : t('entry.scanEmpty'))
    } catch (err) {
      setScanMessage(err instanceof Error ? err.message : t('entry.scanFailed'))
    } finally {
      setScanning(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-3 gap-2">
        {ENTRY_CATEGORIES.map((c) => {
          const Icon = CATEGORY_ICONS[c]
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 text-xs transition-colors ${
                category === c
                  ? 'border-red-600 bg-red-50 font-semibold text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={category === c ? 2.2 : 1.8} aria-hidden />
              {t(categoryKey(c))}
            </button>
          )
        })}
      </div>

      {aiReady && (
        <div className="flex flex-col gap-1">
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleReceipt(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={scanning}
            onClick={() => fileInput.current?.click()}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-red-400 py-2.5 text-sm font-medium text-red-700 disabled:opacity-50 dark:border-red-700 dark:text-red-400"
          >
            <Camera className="h-4 w-4" strokeWidth={2} aria-hidden />
            {scanning ? t('entry.scanning') : t('entry.scan')}
          </button>
          {scanMessage && <span className="muted text-sm">{scanMessage}</span>}
        </div>
      )}

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.date')}</span>
        <input
          type="date"
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
          className={`input ${errors.date ? 'input-error' : ''}`}
        />
        {errors.date && (
          <span role="alert" className="error-text">
            {t(errors.date)}
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.odometer')}</span>
        <input
          inputMode="numeric"
          value={values.odometer}
          onChange={(e) => set('odometer', e.target.value)}
          placeholder={suggestedOdometer ? String(suggestedOdometer) : ''}
          className={`input ${errors.odometer ? 'input-error' : ''}`}
        />
        {errors.odometer && (
          <span role="alert" className="error-text">
            {t(errors.odometer)}
          </span>
        )}
        {!errors.odometer && odometerNote && (
          // A warning, not an error — odometers do get replaced, and backdated
          // entries are normal. Saving stays possible.
          <span className="text-sm text-amber-700 dark:text-amber-400">{t(odometerNote.key, odometerNote.vars)}</span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.totalCost')}</span>
        <input
          inputMode="decimal"
          value={values.cost}
          onChange={(e) => set('cost', e.target.value)}
          placeholder="68.50"
          className={`input ${errors.cost ? 'input-error' : ''}`}
        />
        {errors.cost && (
          <span role="alert" className="error-text">
            {t(errors.cost)}
          </span>
        )}
      </label>

      {isFuel && (
        <>
          <label className="flex flex-col gap-1">
            <span className="label">{t('field.litres')}</span>
            <input
              inputMode="decimal"
              value={values.litres}
              onChange={(e) => set('litres', e.target.value)}
              placeholder="45.3"
              className={`input ${errors.litres ? 'input-error' : ''}`}
            />
            {errors.litres && (
              <span role="alert" className="error-text">
                {t(errors.litres)}
              </span>
            )}
          </label>

          <label className="card flex items-center gap-3 p-3">
            <input
              type="checkbox"
              checked={values.fullTank}
              onChange={(e) => set('fullTank', e.target.checked)}
              className="h-5 w-5 accent-red-600"
            />
            <span className="text-sm">
              <span className="font-medium">{t('field.fullTank')}</span>
              <br />
              <span className="muted">{t('field.fullTankHint')}</span>
            </span>
          </label>
        </>
      )}

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.company')}</span>
        <input
          value={values.company}
          onChange={(e) => set('company', e.target.value)}
          placeholder={t('field.companyHint')}
          className="input"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="label">{t('field.items')}</span>
          {values.items.length > 0 && (
            <span className="faint text-sm">{itemsTotal.toFixed(2)} €</span>
          )}
        </div>

        {values.items.length === 0 ? (
          <p className="faint text-sm">
            What was bought or done, line by line — filled in automatically from a scanned
            receipt.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {values.items.map((item, index) => (
              <li key={index} className="flex items-center gap-2">
                <input
                  value={item.name}
                  onChange={(e) => setItem(index, { name: e.target.value })}
                  placeholder={t('field.itemName')}
                  aria-label={t('entry.a11yItemName', { n: index + 1 })}
                  className="input min-w-0 flex-1"
                />
                <input
                  value={item.price}
                  onChange={(e) => setItem(index, { price: e.target.value })}
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label={t('entry.a11yItemPrice', { n: index + 1 })}
                  className="input w-24 shrink-0 text-right"
                />
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  aria-label={t('entry.a11yRemoveItem', { n: index + 1 })}
                  className="shrink-0 rounded-lg p-2 text-slate-500 active:bg-slate-100 dark:text-slate-400 dark:active:bg-slate-800"
                >
                  <X className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <button type="button" onClick={addItem} className="link-accent self-start text-sm">
          {t('entry.addLine')}
        </button>
      </div>

      <label className="flex flex-col gap-1">
        <span className="label">{t('field.notes')}</span>
        <input
          value={values.notes}
          onChange={(e) => set('notes', e.target.value)}
          className="input"
        />
      </label>

      {attachments}

      <div className="mt-2 flex flex-col gap-2">
        <button type="submit" className="btn-primary">
          {entry ? t('entry.saveChanges') : t('entry.add')}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          {t('action.cancel')}
        </button>
        {onDelete && (
          <button type="button" onClick={onDelete} className="btn-danger">
            {t('entry.delete')}
          </button>
        )}
      </div>
    </form>
  )
}
