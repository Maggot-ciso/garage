import { db, type LogEntry } from './db'
import { newId } from './id'

export type EntryFields = Omit<LogEntry, 'id' | 'createdAt' | 'updatedAt'>

export async function addEntry(fields: EntryFields): Promise<LogEntry> {
  const now = new Date().toISOString()
  const entry: LogEntry = { ...fields, id: newId(), createdAt: now, updatedAt: now }
  await db.entries.add(entry)
  return entry
}

export async function updateEntry(id: string, fields: EntryFields): Promise<void> {
  const existing = await db.entries.get(id)
  if (!existing) throw new Error(`Entry ${id} not found`)
  // put (not update) so fuel-only fields removed by an edit don't linger
  await db.entries.put({
    ...fields,
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  })
}

// Attachments go with the entry: an orphaned blob is invisible to the owner
// but keeps occupying the storage quota forever.
export async function deleteEntry(id: string): Promise<void> {
  await db.transaction('rw', db.entries, db.attachments, async () => {
    await db.entries.delete(id)
    await db.attachments.where('entryId').equals(id).delete()
  })
}

export async function entriesForCar(carId: string): Promise<LogEntry[]> {
  const entries = await db.entries.where('carId').equals(carId).toArray()
  // Newest first; same-day entries fall back to creation order
  return entries.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}
