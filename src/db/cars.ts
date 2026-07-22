import { db, type Car } from './db'
import { newId } from './id'

export type CarFields = Omit<Car, 'id' | 'createdAt' | 'updatedAt'>

export async function addCar(fields: CarFields): Promise<Car> {
  const now = new Date().toISOString()
  const car: Car = { ...fields, id: newId(), createdAt: now, updatedAt: now }
  await db.cars.add(car)
  return car
}

export async function updateCar(id: string, fields: CarFields): Promise<void> {
  const updated = await db.cars.update(id, { ...fields, updatedAt: new Date().toISOString() })
  if (updated === 0) throw new Error(`Car ${id} not found`)
}

export async function deleteCar(id: string): Promise<void> {
  await db.transaction('rw', db.cars, db.entries, async () => {
    await db.entries.where('carId').equals(id).delete()
    await db.cars.delete(id)
  })
}
