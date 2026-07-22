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

// Everything that references a car goes with it. Attachments in particular:
// a deleted vehicle used to leave its bytes — receipts and now the PZP —
// stranded in IndexedDB, invisible but still exported into every backup.
export async function deleteCar(id: string): Promise<void> {
  const tables = [db.cars, db.entries, db.reminders, db.tyreSets, db.attachments, db.chatMessages]
  await db.transaction('rw', tables, async () => {
    await Promise.all([
      db.entries.where('carId').equals(id).delete(),
      db.reminders.where('carId').equals(id).delete(),
      db.tyreSets.where('carId').equals(id).delete(),
      db.attachments.where('carId').equals(id).delete(),
      db.chatMessages.where('carId').equals(id).delete(),
    ])
    await db.cars.delete(id)
  })
}
