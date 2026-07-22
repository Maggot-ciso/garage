import { db, type Car } from './db'
import { getSetting, setSetting, SETTING_KEYS } from './settings'

// One globally selected car shared by Logbook, Insights and Assistant.
// Persisted so it survives restarts; falls back to the first car when the
// stored one was deleted (or nothing was ever picked).
export async function setActiveCar(id: string): Promise<void> {
  await setSetting(SETTING_KEYS.activeCarId, id)
}

export async function resolveActiveCar(): Promise<{ cars: Car[]; car: Car | undefined }> {
  const cars = await db.cars.orderBy('createdAt').toArray()
  const storedId = await getSetting(SETTING_KEYS.activeCarId)
  const car = cars.find((c) => c.id === storedId) ?? cars[0]
  return { cars, car }
}
