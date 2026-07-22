import { db, type Attachment, type Car, type LogEntry, type Reminder, type TyreSet } from './db'
import { base64ToBytes, bytesToBase64 } from './blobCodec'
import { SETTING_KEYS } from './settings'

// Attachment bytes travel as base64 so a backup stays one emailable file.
export type BackupAttachment = Omit<Attachment, 'bytes'> & { data: string }

export interface Backup {
  app: 'garagebook'
  version: 1 | 2
  exportedAt: string
  cars: Car[]
  entries: LogEntry[]
  // Optional: backups made before reminders/tyres existed don't have them
  reminders?: Reminder[]
  tyreSets?: TyreSet[]
  // v2 only, and absent when the owner exported without photos
  attachments?: BackupAttachment[]
  settings: { key: string; value: string }[]
}

export async function exportData(includeAttachments = true): Promise<Backup> {
  const [cars, entries, reminders, tyreSets, settings] = await Promise.all([
    db.cars.toArray(),
    db.entries.toArray(),
    db.reminders.toArray(),
    db.tyreSets.toArray(),
    db.settings.toArray(),
  ])
  const attachments = includeAttachments
    ? (await db.attachments.toArray()).map(({ bytes, ...meta }) => ({
        ...meta,
        data: bytesToBase64(bytes),
      }))
    : undefined

  await db.settings.put({ key: SETTING_KEYS.lastBackupAt, value: new Date().toISOString() })
  return {
    app: 'garagebook',
    version: 2,
    exportedAt: new Date().toISOString(),
    cars,
    entries,
    reminders,
    tyreSets,
    ...(attachments ? { attachments } : {}),
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
  // v1 files predate attachments and still import unchanged
  if (b.version !== 1 && b.version !== 2) {
    throw new Error(`Unsupported backup version: ${String(b.version)}`)
  }
  return b as Backup
}

// Replaces ALL local data with the backup's contents, atomically.
export async function importData(backup: Backup): Promise<void> {
  // Passed as an array: Dexie's varargs transaction overload tops out below
  // the number of stores this now has to clear atomically.
  const tables = [db.cars, db.entries, db.reminders, db.tyreSets, db.attachments, db.settings]
  await db.transaction('rw', tables, async () => {
    await Promise.all([
      db.cars.clear(),
      db.entries.clear(),
      db.reminders.clear(),
      db.tyreSets.clear(),
      db.attachments.clear(),
    ])
    await db.cars.bulkAdd(backup.cars)
    await db.entries.bulkAdd(backup.entries)
    await db.reminders.bulkAdd(backup.reminders ?? [])
    await db.tyreSets.bulkAdd(backup.tyreSets ?? [])
    await db.attachments.bulkAdd(
      (backup.attachments ?? []).map(({ data, ...meta }) => ({
        ...meta,
        bytes: base64ToBytes(data),
      })),
    )
    for (const setting of backup.settings ?? []) {
      if (setting.key === SETTING_KEYS.aiApiKey) continue
      await db.settings.put(setting)
    }
  })
}
