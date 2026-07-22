import { db, type Attachment } from './db'
import { newId } from './id'

export type AttachmentFields = Omit<Attachment, 'id' | 'createdAt'>

export async function addAttachment(fields: AttachmentFields): Promise<Attachment> {
  const attachment: Attachment = {
    ...fields,
    id: newId(),
    createdAt: new Date().toISOString(),
  }
  await db.attachments.add(attachment)
  return attachment
}

export async function attachmentsForEntry(entryId: string): Promise<Attachment[]> {
  const rows = await db.attachments.where('entryId').equals(entryId).toArray()
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function attachmentsForCar(carId: string): Promise<Attachment[]> {
  return db.attachments.where('carId').equals(carId).toArray()
}

// Entry ids that have at least one attachment — lets the logbook list show a
// marker without loading a single blob.
export async function entryIdsWithAttachments(carId: string): Promise<Set<string>> {
  const rows = await db.attachments.where('carId').equals(carId).toArray()
  return new Set(rows.map((a) => a.entryId))
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id)
}

export async function deleteAttachmentsForEntry(entryId: string): Promise<void> {
  await db.attachments.where('entryId').equals(entryId).delete()
}
