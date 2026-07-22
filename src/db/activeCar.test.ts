import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { addCar } from './cars'
import { resolveActiveCar, setActiveCar } from './activeCar'

const fields = { make: 'Hyundai', model: 'Genesis Coupe', year: 2012, odometer: 150000 }

beforeEach(async () => {
  await db.cars.clear()
  await db.settings.clear()
})

describe('active car', () => {
  it('defaults to the first car when nothing was picked', async () => {
    const first = await addCar(fields)
    await addCar({ ...fields, model: 'i30' })
    expect((await resolveActiveCar()).car?.id).toBe(first.id)
  })

  it('persists an explicit selection', async () => {
    await addCar(fields)
    const second = await addCar({ ...fields, model: 'i30' })
    await setActiveCar(second.id)
    expect((await resolveActiveCar()).car?.id).toBe(second.id)
  })

  it('falls back to the first car when the active one is deleted', async () => {
    const first = await addCar(fields)
    const second = await addCar({ ...fields, model: 'i30' })
    await setActiveCar(second.id)
    await db.cars.delete(second.id)
    expect((await resolveActiveCar()).car?.id).toBe(first.id)
  })

  it('returns undefined car with no cars', async () => {
    const { cars, car } = await resolveActiveCar()
    expect(cars).toEqual([])
    expect(car).toBeUndefined()
  })
})
