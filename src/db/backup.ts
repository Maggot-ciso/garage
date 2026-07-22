import { db, type Attachment, type Car, type LogEntry, type Reminder, type TyreSet } from './db'
import { base64ToBytes, bytesToBase64 } from './blobCodec'
import { SETTING_KEYS } from './settings'

// Attachment bytes travel as base64 so a backup stays one emailable file.
export type BackupAttachment = Omit<Attachment, 'bytes'> & { data: string }

export const BACKUP_TABLES = [
  'cars',
  'entries',
  'reminders',
  'tyreSets',
  'attachments',
  'settings',
] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

// What a v1/v2 file is understood to contain. Those versions had no manifest
// and the importer replaced these tables wholesale, so spelling that out here
// keeps old files restoring exactly as they always did.
const LEGACY_INCLUDES: BackupTable[] = [...BACKUP_TABLES]

export interface Backup {
  app: 'garagebook'
  version: 1 | 2 | 3
  exportedAt: string
  cars: Car[]
  entries: LogEntry[]
  // Optional: backups made before reminders/tyres existed don't have them
  reminders?: Reminder[]
  tyreSets?: TyreSet[]
  // v2+ only, and absent when the owner exported without photos
  attachments?: BackupAttachment[]
  settings: { key: string; value: string }[]
  // v3: which tables this file actually claims to carry. Without it an empty
  // array and an unexported table look identical, and the importer would wipe
  // whatever the owner chose not to export.
  includes?: BackupTable[]
  // v3: set when the export was limited to particular vehicles. Its presence
  // is what makes an import merge instead of replace — see importData.
  scope?: { carIds: string[] }
}

export interface ExportOptions {
  /** Which tables to export. Default: all of them. */
  tables?: BackupTable[]
  /** Limit to these vehicles. Default/empty: the whole garage. */
  carIds?: string[]
  /**
   * Carry the attachment bytes. Default true. Turning this off is a size
   * choice, NOT a scope choice: the file still covers the attachments table,
   * so restoring it clears stale blobs rather than leaving them orphaned
   * against entries that no longer exist. Dropping 'attachments' from
   * `tables` is the scope choice, and leaves existing ones untouched.
   */
  withAttachmentBytes?: boolean
}

// The old signature (exportData(includeAttachments)) is still honoured so
// nothing that called it changes meaning.
export async function exportData(
  includeAttachments: boolean | ExportOptions = true,
): Promise<Backup> {
  const options: ExportOptions =
    typeof includeAttachments === 'boolean'
      ? { withAttachmentBytes: includeAttachments }
      : includeAttachments
  const withBytes = options.withAttachmentBytes !== false

  const tables = options.tables ?? [...BACKUP_TABLES]
  const includes = BACKUP_TABLES.filter((t) => tables.includes(t))
  const carIds = options.carIds?.length ? new Set(options.carIds) : null
  const wants = (t: BackupTable) => includes.includes(t)
  const mine = <T extends { carId: string }>(rows: T[]) =>
    carIds ? rows.filter((r) => carIds.has(r.carId)) : rows

  const [cars, entries, reminders, tyreSets, attachments, settings] = await Promise.all([
    wants('cars') ? db.cars.toArray() : Promise.resolve([]),
    wants('entries') ? db.entries.toArray() : Promise.resolve([]),
    wants('reminders') ? db.reminders.toArray() : Promise.resolve([]),
    wants('tyreSets') ? db.tyreSets.toArray() : Promise.resolve([]),
    wants('attachments') && withBytes ? db.attachments.toArray() : Promise.resolve([]),
    wants('settings') ? db.settings.toArray() : Promise.resolve([]),
  ])

  await db.settings.put({ key: SETTING_KEYS.lastBackupAt, value: new Date().toISOString() })

  return {
    app: 'garagebook',
    version: 3,
    exportedAt: new Date().toISOString(),
    includes,
    ...(carIds ? { scope: { carIds: [...carIds] } } : {}),
    cars: carIds ? cars.filter((c) => carIds.has(c.id)) : cars,
    entries: mine(entries),
    ...(wants('reminders') ? { reminders: mine(reminders) } : {}),
    ...(wants('tyreSets') ? { tyreSets: mine(tyreSets) } : {}),
    ...(wants('attachments') && withBytes
      ? {
          attachments: mine(attachments).map(({ bytes, ...meta }) => ({
            ...meta,
            data: bytesToBase64(bytes),
          })),
        }
      : {}),
    // The API key stays on the device it was typed on — never in a backup
    // file that might end up in iCloud, email, or a chat app.
    settings: settings.filter((s) => s.key !== SETTING_KEYS.aiApiKey),
  }
}

export function daysSince(iso: string | undefined, now = Date.now()): number | null {
  if (!iso) return null
  return Math.floor((now - Date.parse(iso)) / 86_400_000)
}

export function parseBackup(json: string): Backup {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new Error('That file is not valid JSON.')
  }
  const b = parsed as Partial<Backup>
  if (b?.app !== 'garagebook' || !Array.isArray(b.cars) || !Array.isArray(b.entries)) {
    throw new Error('That file does not look like a GarageBook backup.')
  }
  // v1 files predate attachments, v2 predates the manifest; both still import
  if (b.version !== 1 && b.version !== 2 && b.version !== 3) {
    throw new Error(`Unsupported backup version: ${String(b.version)}`)
  }
  return b as Backup
}

/** What importing this file will actually do, so the UI can say so up front. */
export function describeImport(backup: Backup): {
  mode: 'replace' | 'merge'
  tables: BackupTable[]
  carIds: string[] | null
} {
  return {
    mode: backup.scope ? 'merge' : 'replace',
    tables: backup.includes ?? LEGACY_INCLUDES,
    carIds: backup.scope?.carIds ?? null,
  }
}

// A full backup restores: the listed tables are replaced wholesale, which is
// what "restore my phone" means. A vehicle-scoped backup merges instead —
// importing one vehicle must not delete the rest of the garage. Tables the
// file does not claim to carry are never touched either way.
export async function importData(backup: Backup): Promise<void> {
  const { mode, tables } = describeImport(backup)
  const wants = (t: BackupTable) => tables.includes(t)

  const attachments = (backup.attachments ?? []).map(({ data, ...meta }) => ({
    ...meta,
    bytes: base64ToBytes(data),
  }))

  // Passed as an array: Dexie's varargs transaction overload tops out below
  // the number of stores this has to touch atomically.
  const stores = [db.cars, db.entries, db.reminders, db.tyreSets, db.attachments, db.settings]
  await db.transaction('rw', stores, async () => {
    if (mode === 'replace') {
      await Promise.all([
        wants('cars') ? db.cars.clear() : undefined,
        wants('entries') ? db.entries.clear() : undefined,
        wants('reminders') ? db.reminders.clear() : undefined,
        wants('tyreSets') ? db.tyreSets.clear() : undefined,
        wants('attachments') ? db.attachments.clear() : undefined,
      ])
    }

    // bulkPut throughout: on a merge it overwrites the same ids and leaves
    // everything else alone; after a clear it behaves exactly like bulkAdd.
    if (wants('cars')) await db.cars.bulkPut(backup.cars)
    if (wants('entries')) await db.entries.bulkPut(backup.entries)
    if (wants('reminders')) await db.reminders.bulkPut(backup.reminders ?? [])
    if (wants('tyreSets')) await db.tyreSets.bulkPut(backup.tyreSets ?? [])
    if (wants('attachments')) await db.attachments.bulkPut(attachments)

    if (wants('settings')) {
      for (const setting of backup.settings ?? []) {
        if (setting.key === SETTING_KEYS.aiApiKey) continue
        await db.settings.put(setting)
      }
    }
  })
}
