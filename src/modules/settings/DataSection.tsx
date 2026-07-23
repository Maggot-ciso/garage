import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import {
  BACKUP_TABLES,
  daysSince,
  describeImport,
  exportData,
  importData,
  parseBackup,
  type BackupTable,
} from '../../db/backup'
import { describeSize } from '../logbook/imageProcessing'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/en'

const TYPE_LABEL: Record<BackupTable, TranslationKey> = {
  cars: 'data.type.cars',
  entries: 'data.type.entries',
  reminders: 'data.type.reminders',
  tyreSets: 'data.type.tyreSets',
  attachments: 'data.type.attachments',
  settings: 'data.type.settings',
}

export function DataSection({ lastBackupAt }: { lastBackupAt: string | undefined }) {
  const t = useT()
  const cars = useLiveQuery(() => db.cars.orderBy('createdAt').toArray(), [])
  const [tables, setTables] = useState<BackupTable[]>([...BACKUP_TABLES])
  // Empty means the whole garage — the same convention exportData uses.
  const [carIds, setCarIds] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const importInput = useRef<HTMLInputElement>(null)

  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const everything = tables.length === BACKUP_TABLES.length && carIds.length === 0

  async function handleExport() {
    if (tables.length === 0) {
      setMessage(t('data.nothingSelected'))
      return
    }
    const backup = await exportData({ tables, ...(carIds.length ? { carIds } : {}) })
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    // A filename, not prose — it stays the same in any language.
    a.download = `garagebook-backup-${backup.exportedAt.slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    setMessage(t('data.exported', { what: summarise(backup, t), size: describeSize(blob.size) }))
  }

  async function handleImport(file: File) {
    try {
      const backup = parseBackup(await file.text())
      const plan = describeImport(backup)
      const what = summarise(backup, t)
      const date = backup.exportedAt.slice(0, 10)
      const question =
        plan.mode === 'merge'
          ? t('data.confirmMerge', { what, date, count: plan.carIds?.length ?? 0 })
          : t('data.confirmReplace', {
              what,
              date,
              tables: plan.tables.map((table) => t(TYPE_LABEL[table])).join(', '),
            })
      if (!window.confirm(question)) return
      await importData(backup)
      setMessage(t('data.imported', { what }))
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t('data.importFailed'))
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="section-title">{t('data.title')}</h2>
      <p className="muted text-sm">{t('data.blurb')}</p>

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1">{t('data.whatToExport')}</legend>
        {BACKUP_TABLES.map((table) => (
          <label key={table} className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={tables.includes(table)}
              onChange={() => setTables((current) => toggle(current, table))}
              className="h-4 w-4 accent-red-600"
            />
            <span className="text-sm">{t(TYPE_LABEL[table])}</span>
          </label>
        ))}
      </fieldset>

      {(cars?.length ?? 0) > 1 && (
        <fieldset className="flex flex-col gap-2">
          <legend className="label mb-1">{t('data.whichVehicles')}</legend>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={carIds.length === 0}
              onChange={() => setCarIds([])}
              className="h-4 w-4 accent-red-600"
            />
            <span className="text-sm">{t('data.allVehicles')}</span>
          </label>
          {(cars ?? []).map((car) => (
            <label key={car.id} className="flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={carIds.includes(car.id)}
                onChange={() => setCarIds((current) => toggle(current, car.id))}
                className="h-4 w-4 accent-red-600"
              />
              <span className="text-sm">
                {car.make} {car.model}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      {/* Say what a partial file will do before it is made, not after. */}
      {carIds.length > 0 && <p className="faint text-sm">{t('data.scopedNote')}</p>}
      {!everything && carIds.length === 0 && (
        <p className="faint text-sm">{t('data.partialNote')}</p>
      )}

      <button type="button" onClick={() => void handleExport()} className="btn-primary">
        {t('data.exportButton')}
      </button>

      <input
        ref={importInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void handleImport(file)
        }}
      />
      <button
        type="button"
        onClick={() => importInput.current?.click()}
        className="btn-secondary"
      >
        {t('data.importButton')}
      </button>

      {message && <span className="muted text-sm">{message}</span>}

      <span className="muted text-sm">
        {(() => {
          const days = daysSince(lastBackupAt)
          if (days === null) return t('data.noBackupYet')
          if (days === 0) return t('data.backupToday')
          return t('data.backupDaysAgo', { days })
        })()}
      </span>
    </section>
  )
}

// Counts, not table names — what the owner can check against what they
// expected to export. Rendered as labelled counts ("vozidlá: 2, záznamy: 14")
// rather than "2 vozidlá": the label form sidesteps Slovak's plural agreement
// on every noun here, which would otherwise need four forms each.
function summarise(
  backup: {
    cars: unknown[]
    entries: unknown[]
    reminders?: unknown[]
    tyreSets?: unknown[]
    attachments?: unknown[]
  },
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
): string {
  const parts = [
    backup.cars.length ? t('data.summary.vehicles', { n: backup.cars.length }) : null,
    backup.entries.length ? t('data.summary.entries', { n: backup.entries.length }) : null,
    backup.reminders?.length ? t('data.summary.reminders', { n: backup.reminders.length }) : null,
    backup.tyreSets?.length ? t('data.summary.tyreSets', { n: backup.tyreSets.length }) : null,
    backup.attachments?.length ? t('data.summary.files', { n: backup.attachments.length }) : null,
  ].filter(Boolean)
  return parts.length ? parts.join(', ') : t('data.summary.nothing')
}
