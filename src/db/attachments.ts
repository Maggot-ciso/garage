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
// marker without loading a single blob. Vehicle documents have no entryId and
// must not leak in as an `undefined` member of the set.
export async function entryIdsWithAttachments(carId: string): Promise<Set<string>> {
  const rows = await db.attachments.where('carId').equals(carId).toArray()
  const ids = new Set<string>()
  for (const row of rows) if (row.entryId) ids.add(row.entryId)
  return ids
}

// --- Vehicle documents -----------------------------------------------------
// The PZP (mandatory third-party cover) and havarijná poistka (comprehensive)
// belong to the vehicle, not to any single logbook entry — the point is to show
// the certificate to police from the phone instead of carrying paper. They are
// ordinary attachments with no entryId, so backup, restore and per-car cleanup
// already carry them for free.

export type VehicleDocumentFields = Omit<Attachment, 'id' | 'createdAt' | 'entryId'>

export async function addVehicleDocument(
  fields: VehicleDocumentFields,
): Promise<Attachment> {
  return addAttachment(fields)
}

export async function vehicleDocuments(carId: string): Promise<Attachment[]> {
  const rows = await db.attachments.where('carId').equals(carId).toArray()
  return rows.filter((a) => !a.entryId).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

export async function deleteAttachmentsForCar(carId: string): Promise<void> {
  await db.attachments.where('carId').equals(carId).delete()
}

export async function deleteAttachment(id: string): Promise<void> {
  await db.attachments.delete(id)
}

export async function deleteAttachmentsForEntry(entryId: string): Promise<void> {
  await db.attachments.where('entryId').equals(entryId).delete()
}
