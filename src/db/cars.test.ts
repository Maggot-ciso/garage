import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCar, deleteCar, updateCar, type CarFields } from './cars'

const fields: CarFields = {
  make: 'Škoda',
  model: 'Octavia',
  year: 2018,
  engine: '2.0 TDI',
  vin: 'TMBJJ7NE4J0123456',
  odometer: 154000,
}

beforeEach(async () => {
  await db.cars.clear()
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
