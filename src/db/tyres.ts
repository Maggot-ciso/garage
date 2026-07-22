import { db, type Reminder, type TreadReading, type TyreSet } from './db'
import { newId } from './id'
import { nextSwapDate, setLabel } from '../modules/tyres/tyreLogic'

export type TyreSetFields = Omit<
  TyreSet,
  'id' | 'createdAt' | 'updatedAt' | 'status' | 'treadReadings' | 'fittedPeriods'
>

export interface SwapContext {
  date: string // YYYY-MM-DD
  odometer: number
}

export async function tyreSetsForCar(carId: string): Promise<TyreSet[]> {
  return db.tyreSets.where('carId').equals(carId).toArray()
}

export async function addTyreSet(fields: TyreSetFields): Promise<TyreSet> {
  const now = new Date().toISOString()
  const set: TyreSet = {
    ...fields,
    id: newId(),
    status: 'stored',
    treadReadings: [],
    fittedPeriods: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', db.tyreSets, db.reminders, async () => {
    await db.tyreSets.add(set)
    await syncSwapReminder(set, new Date().toISOString().slice(0, 10))
  })
  return set
}

export async function updateTyreSet(id: string, fields: TyreSetFields): Promise<void> {
  await db.transaction('rw', db.tyreSets, db.reminders, async () => {
    const existing = await db.tyreSets.get(id)
    if (!existing) throw new Error(`Tyre set ${id} not found`)
    // put (not update) so cleared optional fields don't linger
    const updated: TyreSet = {
      ...fields,
      id,
      status: existing.status,
      treadReadings: existing.treadReadings,
      fittedPeriods: existing.fittedPeriods,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    }
    await db.tyreSets.put(updated)
    await syncSwapReminder(updated, new Date().toISOString().slice(0, 10))
  })
}

export async function deleteTyreSet(id: string): Promise<void> {
  await db.transaction('rw', db.tyreSets, db.reminders, async () => {
    await db.tyreSets.delete(id)
    for (const reminder of await openSwapReminders(id)) {
      await db.reminders.delete(reminder.id)
    }
  })
}

export async function addTreadReading(id: string, reading: TreadReading): Promise<void> {
  const set = await db.tyreSets.get(id)
  if (!set) throw new Error(`Tyre set ${id} not found`)
  await db.tyreSets.update(id, {
    treadReadings: [...set.treadReadings, reading],
    updatedAt: new Date().toISOString(),
  })
}

export async function deleteTreadReading(id: string, reading: TreadReading): Promise<void> {
  const set = await db.tyreSets.get(id)
  if (!set) throw new Error(`Tyre set ${id} not found`)
  const index = set.treadReadings.findIndex(
    (r) => r.date === reading.date && r.mm === reading.mm,
  )
  if (index === -1) return
  const treadReadings = set.treadReadings.filter((_, i) => i !== index)
  await db.tyreSets.update(id, { treadReadings, updatedAt: new Date().toISOString() })
}

// Fits `incomingId` and takes whatever was on the car off, in one transaction:
// the invariant is that a car never has two fitted sets.
export async function swapTyreSets(
  carId: string,
  incomingId: string,
  { date, odometer }: SwapContext,
): Promise<void> {
  await db.transaction('rw', db.tyreSets, db.reminders, async () => {
    const sets = await db.tyreSets.where('carId').equals(carId).toArray()
    const incoming = sets.find((s) => s.id === incomingId)
    if (!incoming) throw new Error(`Tyre set ${incomingId} not found`)
    // Already on the car with an open period: fitting it again would open a
    // second period and double-count km-on-set. Nothing to do.
    if (incoming.status === 'fitted' && hasOpenPeriod(incoming)) return
    const now = new Date().toISOString()

    for (const outgoing of sets) {
      if (outgoing.id === incomingId || outgoing.status !== 'fitted') continue
      await db.tyreSets.put({
        ...outgoing,
        status: 'stored',
        fittedPeriods: closeOpenPeriod(outgoing, date, odometer),
        updatedAt: now,
      })
      // The set coming off is the one to put back on next season
      await syncSwapReminder({ ...outgoing, status: 'stored' }, date)
    }

    await db.tyreSets.put({
      ...incoming,
      status: 'fitted',
      fittedPeriods: [...incoming.fittedPeriods, { fromDate: date, fromOdo: odometer }],
      updatedAt: now,
    })
    // Fitting it satisfies its own reminder
    for (const reminder of await openSwapReminders(incomingId)) {
      await db.reminders.update(reminder.id, { completedAt: now, updatedAt: now })
    }
  })
}

function hasOpenPeriod(set: TyreSet): boolean {
  return set.fittedPeriods.some((p) => p.toDate === undefined)
}

function closeOpenPeriod(set: TyreSet, date: string, odometer: number) {
  return set.fittedPeriods.map((period, index) =>
    index === set.fittedPeriods.length - 1 && period.toDate === undefined
      ? { ...period, toDate: date, toOdo: odometer }
      : period,
  )
}

async function openSwapReminders(tyreSetId: string): Promise<Reminder[]> {
  return (await db.reminders.toArray()).filter(
    (r) => r.tyreSetId === tyreSetId && !r.completedAt,
  )
}

// A stored set with a swap month always has exactly one open reminder for the
// date it should go back on; anything else (fitted, or no month) has none.
async function syncSwapReminder(set: TyreSet, afterISO: string): Promise<void> {
  const existing = await openSwapReminders(set.id)
  const dueDate = set.status === 'stored' ? nextSwapDate(set.swapMonth, afterISO) : null

  if (dueDate === null) {
    for (const reminder of existing) await db.reminders.delete(reminder.id)
    return
  }

  const now = new Date().toISOString()
  const title = `Fit ${setLabel(set)}`
  const [keep, ...duplicates] = existing
  for (const reminder of duplicates) await db.reminders.delete(reminder.id)

  if (keep) {
    // Editing an unrelated field must not drag a reminder that was already
    // pushed to next year (by a dismissal) back to this year. Only re-anchor
    // when the existing date no longer matches the set's swap month.
    const stillAnchored = keep.dueDate?.slice(5, 7) === String(set.swapMonth).padStart(2, '0')
    await db.reminders.update(keep.id, {
      title,
      ...(stillAnchored ? {} : { dueDate }),
      updatedAt: now,
    })
    return
  }
  await db.reminders.add({
    id: newId(),
    carId: set.carId,
    title,
    dueDate,
    tyreSetId: set.id,
    createdAt: now,
    updatedAt: now,
  })
}
