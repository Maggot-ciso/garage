import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addEntry, deleteEntry, type EntryFields } from './entries'
import {
  addAttachment,
  addVehicleDocument,
  attachmentsForCar,
  attachmentsForEntry,
  deleteAttachment,
  deleteAttachmentsForCar,
  entryIdsWithAttachments,
  vehicleDocuments,
} from './attachments'

const CAR = 'car-1'

const entryFields: EntryFields = {
  carId: CAR,
  date: '2026-07-01',
  odometer: 150_000,
  cost: 62,
  category: 'fuel',
}

function file(name = 'receipt.jpg', mime = 'image/jpeg') {
  const bytes = new Uint8Array([1, 2, 3]).buffer
  return { carId: CAR, name, mime, size: bytes.byteLength, bytes }
}

beforeEach(async () => {
  await db.entries.clear()
  await db.attachments.clear()
})

describe('attachments repository', () => {
  it('stores an attachment against its entry and car', async () => {
    const entry = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: entry.id })

    const forEntry = await attachmentsForEntry(entry.id)
    expect(forEntry).toHaveLength(1)
    expect(forEntry[0]).toMatchObject({ name: 'receipt.jpg', mime: 'image/jpeg', carId: CAR })
    expect(await attachmentsForCar(CAR)).toHaveLength(1)
  })

  it('keeps the bytes intact through a store and read', async () => {
    const entry = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: entry.id })
    const [stored] = await attachmentsForEntry(entry.id)
    expect([...new Uint8Array(stored!.bytes)]).toEqual([1, 2, 3])
  })

  it('scopes queries to the right entry and car', async () => {
    const a = await addEntry(entryFields)
    const b = await addEntry({ ...entryFields, carId: 'car-2' })
    await addAttachment({ ...file('a.jpg'), entryId: a.id })
    await addAttachment({ ...file('b.jpg'), carId: 'car-2', entryId: b.id })

    expect(await attachmentsForEntry(a.id)).toHaveLength(1)
    expect(await attachmentsForCar(CAR)).toHaveLength(1)
    expect(await attachmentsForCar('car-2')).toHaveLength(1)
  })

  it('reports which entries have attachments without loading blobs', async () => {
    const withOne = await addEntry(entryFields)
    const without = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: withOne.id })

    const ids = await entryIdsWithAttachments(CAR)
    expect(ids.has(withOne.id)).toBe(true)
    expect(ids.has(without.id)).toBe(false)
  })

  it('deletes a single attachment', async () => {
    const entry = await addEntry(entryFields)
    const one = await addAttachment({ ...file('one.jpg'), entryId: entry.id })
    await addAttachment({ ...file('two.jpg'), entryId: entry.id })

    await deleteAttachment(one.id)
    expect((await attachmentsForEntry(entry.id)).map((a) => a.name)).toEqual(['two.jpg'])
  })

  it('deleting an entry takes its attachments with it', async () => {
    const entry = await addEntry(entryFields)
    const other = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: entry.id })
    await addAttachment({ ...file(), entryId: other.id })

    await deleteEntry(entry.id)
    expect(await attachmentsForEntry(entry.id)).toHaveLength(0)
    expect(await attachmentsForEntry(other.id)).toHaveLength(1)
  })
})

// PZP / havarijná poistka: attached to the vehicle, not to a logbook entry.
describe('vehicle documents', () => {
  const pzp = () => ({ ...file('pzp.pdf', 'application/pdf') })

  it('stores a document against the car with no entry', async () => {
    const doc = await addVehicleDocument(pzp())

    expect(doc.entryId).toBeUndefined()
    expect(await vehicleDocuments(CAR)).toHaveLength(1)
    expect((await vehicleDocuments(CAR))[0]).toMatchObject({
      name: 'pzp.pdf',
      mime: 'application/pdf',
    })
  })

  it('keeps documents and entry attachments out of each other’s queries', async () => {
    const entry = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: entry.id })
    await addVehicleDocument(pzp())

    // The receipt is not a vehicle document...
    expect((await vehicleDocuments(CAR)).map((a) => a.name)).toEqual(['pzp.pdf'])
    // ...and the PZP is not an attachment of any entry.
    expect(await attachmentsForEntry(entry.id)).toHaveLength(1)
    expect((await attachmentsForEntry(entry.id))[0]!.name).toBe('receipt.jpg')
    // Both still belong to the car.
    expect(await attachmentsForCar(CAR)).toHaveLength(2)
  })

  it('does not put an undefined entry id in the has-attachments set', async () => {
    await addVehicleDocument(pzp())
    const ids = await entryIdsWithAttachments(CAR)

    expect(ids.size).toBe(0)
    expect([...ids]).not.toContain(undefined)
  })

  it('scopes documents to their own car', async () => {
    await addVehicleDocument(pzp())
    await addVehicleDocument({ ...pzp(), carId: 'car-2', name: 'other.pdf' })

    expect((await vehicleDocuments(CAR)).map((a) => a.name)).toEqual(['pzp.pdf'])
    expect((await vehicleDocuments('car-2')).map((a) => a.name)).toEqual(['other.pdf'])
  })

  it('deletes a single document', async () => {
    const doc = await addVehicleDocument(pzp())
    await addVehicleDocument({ ...pzp(), name: 'havarijna.pdf' })

    await deleteAttachment(doc.id)
    expect((await vehicleDocuments(CAR)).map((a) => a.name)).toEqual(['havarijna.pdf'])
  })

  it('clears every attachment a car has, documents included', async () => {
    const entry = await addEntry(entryFields)
    await addAttachment({ ...file(), entryId: entry.id })
    await addVehicleDocument(pzp())
    await addVehicleDocument({ ...pzp(), carId: 'car-2' })

    await deleteAttachmentsForCar(CAR)
    expect(await attachmentsForCar(CAR)).toHaveLength(0)
    expect(await attachmentsForCar('car-2')).toHaveLength(1)
  })
})
