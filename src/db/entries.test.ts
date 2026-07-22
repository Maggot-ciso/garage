import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCar, deleteCar } from './cars'
import { addEntry, deleteEntry, entriesForCar, updateEntry, type EntryFields } from './entries'

const fuel: EntryFields = {
  carId: 'car-1',
  category: 'fuel',
  date: '2026-07-15',
  odometer: 155200,
  cost: 68.5,
  litres: 45.3,
  pricePerLitre: 1.512,
  fullTank: true,
}

beforeEach(async () => {
  await db.entries.clear()
  await db.cars.clear()
})

describe('entries repository', () => {
  it('adds and lists entries newest-first', async () => {
    await addEntry({ ...fuel, date: '2026-06-01' })
    await addEntry({ ...fuel, date: '2026-07-15' })
    await addEntry({ ...fuel, date: '2026-01-10', category: 'service' })
    const list = await entriesForCar('car-1')
    expect(list.map((e) => e.date)).toEqual(['2026-07-15', '2026-06-01', '2026-01-10'])
  })

  it('only returns entries for the requested car', async () => {
    await addEntry(fuel)
    await addEntry({ ...fuel, carId: 'car-2' })
    expect(await entriesForCar('car-1')).toHaveLength(1)
  })

  it('update replaces the record so cleared fuel fields do not linger', async () => {
    const entry = await addEntry(fuel)
    await updateEntry(entry.id, {
      carId: 'car-1',
      category: 'repair',
      date: '2026-07-15',
      odometer: 155200,
      cost: 120,
    })
    const stored = await db.entries.get(entry.id)
    expect(stored?.category).toBe('repair')
    expect(stored?.litres).toBeUndefined()
    expect(stored?.fullTank).toBeUndefined()
    expect(stored?.createdAt).toBe(entry.createdAt)
  })

  it('throws when updating a missing entry', async () => {
    await expect(updateEntry('nope', fuel)).rejects.toThrow('not found')
  })

  it('deletes an entry', async () => {
    const entry = await addEntry(fuel)
    await deleteEntry(entry.id)
    expect(await db.entries.get(entry.id)).toBeUndefined()
  })

  it('deleting a car cascades to its entries', async () => {
    const car = await addCar({ make: 'Škoda', model: 'Octavia', year: 2018, odometer: 155200 })
    await addEntry({ ...fuel, carId: car.id })
    await addEntry({ ...fuel, carId: 'other-car' })
    await deleteCar(car.id)
    expect(await entriesForCar(car.id)).toHaveLength(0)
    expect(await entriesForCar('other-car')).toHaveLength(1)
  })
})
