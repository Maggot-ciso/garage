import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCar, deleteCar, updateCar, type CarFields } from './cars'
import { addAttachment, addVehicleDocument } from './attachments'
import { addEntry } from './entries'

const fields: CarFields = {
  make: 'Škoda',
  model: 'Octavia',
  year: 2018,
  engine: '2.0 TDI',
  vin: 'TMBJJ7NE4J0123456',
  odometer: 154000,
}

beforeEach(async () => {
  await Promise.all([
    db.cars.clear(),
    db.entries.clear(),
    db.reminders.clear(),
    db.tyreSets.clear(),
    db.attachments.clear(),
    db.chatMessages.clear(),
  ])
})

describe('cars repository', () => {
  it('adds a car with generated id and timestamps', async () => {
    const car = await addCar(fields)
    expect(car.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(car.createdAt).toBe(car.updatedAt)
    expect(await db.cars.get(car.id)).toEqual(car)
  })

  it('updates fields and bumps updatedAt', async () => {
    const car = await addCar(fields)
    await updateCar(car.id, { ...fields, odometer: 155000 })
    const stored = await db.cars.get(car.id)
    expect(stored?.odometer).toBe(155000)
    expect(stored?.createdAt).toBe(car.createdAt)
    expect(Date.parse(stored!.updatedAt)).toBeGreaterThanOrEqual(Date.parse(car.updatedAt))
  })

  it('throws when updating a missing car', async () => {
    await expect(updateCar('nope', fields)).rejects.toThrow('not found')
  })

  it('deletes a car', async () => {
    const car = await addCar(fields)
    await deleteCar(car.id)
    expect(await db.cars.get(car.id)).toBeUndefined()
  })
})

// A deleted vehicle used to leave its reminders, tyre sets, chat and
// attachments behind: invisible in the UI, but still exported into every
// backup and still counted against storage.
describe('deleting a car takes its data with it', () => {
  async function carWithEverything() {
    const car = await addCar(fields)
    const entry = await addEntry({
      carId: car.id,
      date: '2026-07-01',
      odometer: 154000,
      cost: 60,
      category: 'fuel',
    })
    const bytes = new Uint8Array([1, 2, 3]).buffer
    await addAttachment({
      carId: car.id,
      entryId: entry.id,
      name: 'receipt.jpg',
      mime: 'image/jpeg',
      size: bytes.byteLength,
      bytes,
    })
    await addVehicleDocument({
      carId: car.id,
      name: 'pzp.pdf',
      mime: 'application/pdf',
      size: bytes.byteLength,
      bytes,
    })
    await db.reminders.add({
      id: `r-${car.id}`,
      carId: car.id,
      title: 'Service',
      dueDate: '2026-09-01',
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    })
    await db.tyreSets.add({
      id: `t-${car.id}`,
      carId: car.id,
      season: 'winter',
      status: 'stored',
      treadReadings: [],
      fittedPeriods: [],
      createdAt: '2026-07-01',
      updatedAt: '2026-07-01',
    })
    await db.chatMessages.add({
      id: `m-${car.id}`,
      carId: car.id,
      role: 'user',
      text: 'hello',
      createdAt: '2026-07-01',
    })
    return car
  }

  it('leaves nothing orphaned', async () => {
    const car = await carWithEverything()
    await deleteCar(car.id)

    expect(await db.cars.count()).toBe(0)
    expect(await db.entries.count()).toBe(0)
    expect(await db.attachments.count()).toBe(0)
    expect(await db.reminders.count()).toBe(0)
    expect(await db.tyreSets.count()).toBe(0)
    expect(await db.chatMessages.count()).toBe(0)
  })

  it('does not touch another car', async () => {
    const doomed = await carWithEverything()
    const keeper = await carWithEverything()

    await deleteCar(doomed.id)

    expect(await db.cars.count()).toBe(1)
    expect(await db.attachments.where('carId').equals(keeper.id).count()).toBe(2)
    expect(await db.entries.where('carId').equals(keeper.id).count()).toBe(1)
  })
})
