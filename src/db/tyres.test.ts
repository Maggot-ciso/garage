import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addTreadReading,
  addTyreSet,
  deleteTyreSet,
  swapTyreSets,
  tyreSetsForCar,
  updateTyreSet,
  type TyreSetFields,
} from './tyres'

const CAR = 'car-1'

const summer: TyreSetFields = {
  carId: CAR,
  season: 'summer',
  brand: 'Michelin',
  model: 'Pilot Sport 4',
  swapMonth: 4,
}

const winter: TyreSetFields = {
  carId: CAR,
  season: 'winter',
  brand: 'Nokian',
  swapMonth: 10,
}

beforeEach(async () => {
  await db.tyreSets.clear()
  await db.reminders.clear()
})

async function openReminders() {
  return (await db.reminders.toArray()).filter((r) => !r.completedAt)
}

describe('tyre sets repository', () => {
  it('adds sets stored, scoped to their car', async () => {
    await addTyreSet(summer)
    await addTyreSet({ ...winter, carId: 'car-2' })

    const sets = await tyreSetsForCar(CAR)
    expect(sets).toHaveLength(1)
    expect(sets[0]).toMatchObject({ season: 'summer', status: 'stored' })
    expect(sets[0]!.fittedPeriods).toEqual([])
  })

  it('creates one swap reminder for a stored set with a swap month', async () => {
    const set = await addTyreSet(summer)
    const [reminder, ...rest] = await openReminders()
    expect(rest).toHaveLength(0)
    expect(reminder).toMatchObject({ carId: CAR, tyreSetId: set.id })
    expect(reminder!.title).toBe('Fit Michelin Pilot Sport 4')
    expect(reminder!.dueDate?.slice(5)).toBe('04-01')
  })

  it('creates no reminder without a swap month', async () => {
    await addTyreSet({ carId: CAR, season: 'all-season' })
    expect(await openReminders()).toHaveLength(0)
  })

  it('drops the reminder when the swap month is cleared', async () => {
    const set = await addTyreSet(summer)
    expect(await openReminders()).toHaveLength(1)
    await updateTyreSet(set.id, { carId: CAR, season: 'summer', brand: 'Michelin' })
    expect(await openReminders()).toHaveLength(0)
  })

  it('keeps optional fields from lingering after an edit', async () => {
    const set = await addTyreSet({ ...summer, storageLocation: 'Cellar' })
    await updateTyreSet(set.id, { carId: CAR, season: 'summer', swapMonth: 4 })
    const updated = await db.tyreSets.get(set.id)
    expect(updated!.storageLocation).toBeUndefined()
    expect(updated!.brand).toBeUndefined()
  })

  it('deletes a set together with its reminder', async () => {
    const set = await addTyreSet(summer)
    await deleteTyreSet(set.id)
    expect(await tyreSetsForCar(CAR)).toHaveLength(0)
    expect(await openReminders()).toHaveLength(0)
  })

  it('appends tread readings', async () => {
    const set = await addTyreSet(summer)
    await addTreadReading(set.id, { date: '2026-04-01', mm: 6.5 })
    await addTreadReading(set.id, { date: '2026-10-01', mm: 5.1 })
    const stored = await db.tyreSets.get(set.id)
    expect(stored!.treadReadings).toEqual([
      { date: '2026-04-01', mm: 6.5 },
      { date: '2026-10-01', mm: 5.1 },
    ])
  })
})

describe('swapTyreSets', () => {
  it('never leaves two sets fitted', async () => {
    const s = await addTyreSet(summer)
    const w = await addTyreSet(winter)

    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })
    await swapTyreSets(CAR, w.id, { date: '2026-10-12', odometer: 148_200 })

    const sets = await tyreSetsForCar(CAR)
    expect(sets.filter((set) => set.status === 'fitted')).toHaveLength(1)
    expect(sets.find((set) => set.id === w.id)!.status).toBe('fitted')
  })

  it('closes the outgoing period and opens the incoming one', async () => {
    const s = await addTyreSet(summer)
    const w = await addTyreSet(winter)

    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })
    await swapTyreSets(CAR, w.id, { date: '2026-10-12', odometer: 148_200 })

    const stored = await db.tyreSets.get(s.id)
    expect(stored!.fittedPeriods).toEqual([
      { fromDate: '2026-04-05', fromOdo: 130_000, toDate: '2026-10-12', toOdo: 148_200 },
    ])
    const fitted = await db.tyreSets.get(w.id)
    expect(fitted!.fittedPeriods).toEqual([{ fromDate: '2026-10-12', fromOdo: 148_200 }])
  })

  it('completes the fitted set reminder and schedules the set coming off', async () => {
    const s = await addTyreSet(summer)
    const w = await addTyreSet(winter)
    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })

    // Summer is on: only winter's "fit in October" reminder stays open
    const afterSpring = await openReminders()
    expect(afterSpring).toHaveLength(1)
    expect(afterSpring[0]).toMatchObject({ tyreSetId: w.id })
    expect(afterSpring[0]!.dueDate).toBe('2026-10-01')

    await swapTyreSets(CAR, w.id, { date: '2026-10-12', odometer: 148_200 })
    const afterAutumn = await openReminders()
    expect(afterAutumn).toHaveLength(1)
    expect(afterAutumn[0]).toMatchObject({ tyreSetId: s.id })
    expect(afterAutumn[0]!.dueDate).toBe('2027-04-01')
  })

  it('keeps a late swap anchored to the same month next year', async () => {
    const s = await addTyreSet(summer)
    const w = await addTyreSet(winter)
    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })
    // Three weeks late — next spring swap must still be April, not November
    await swapTyreSets(CAR, w.id, { date: '2026-10-22', odometer: 149_000 })

    const [reminder] = await openReminders()
    expect(reminder!.dueDate).toBe('2027-04-01')
  })

  it('does not duplicate reminders across several seasons', async () => {
    const s = await addTyreSet(summer)
    const w = await addTyreSet(winter)
    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })
    await swapTyreSets(CAR, w.id, { date: '2026-10-12', odometer: 148_200 })
    await swapTyreSets(CAR, s.id, { date: '2027-04-08', odometer: 158_000 })
    await swapTyreSets(CAR, w.id, { date: '2027-10-10', odometer: 172_000 })

    expect(await openReminders()).toHaveLength(1)
  })

  it('rejects a set that does not exist', async () => {
    await expect(
      swapTyreSets(CAR, 'nope', { date: '2026-04-05', odometer: 130_000 }),
    ).rejects.toThrow(/not found/)
  })
})


describe('regressions', () => {
  it('editing a set keeps a reminder that was already pushed to next year', async () => {
    const set = await addTyreSet(winter)
    const [created] = await openReminders()
    // Simulate the dismissal path having re-anchored it to next year
    await db.reminders.update(created!.id, { dueDate: '2027-10-01' })

    await updateTyreSet(set.id, { carId: CAR, season: 'winter', brand: 'Nokian', swapMonth: 10 })

    const [after] = await openReminders()
    expect(after!.dueDate).toBe('2027-10-01')
  })

  it('re-anchors when the swap month itself changes', async () => {
    const set = await addTyreSet(winter)
    await updateTyreSet(set.id, { carId: CAR, season: 'winter', brand: 'Nokian', swapMonth: 11 })
    const [after] = await openReminders()
    expect(after!.dueDate?.slice(5)).toBe('11-01')
  })

  it('fitting a set that is already on the car does not open a second period', async () => {
    const s = await addTyreSet(summer)
    await swapTyreSets(CAR, s.id, { date: '2026-04-05', odometer: 130_000 })
    await swapTyreSets(CAR, s.id, { date: '2026-05-05', odometer: 135_000 })

    const stored = await db.tyreSets.get(s.id)
    expect(stored!.fittedPeriods).toEqual([{ fromDate: '2026-04-05', fromOdo: 130_000 }])
  })
})
