import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type TyreSet } from './db'
import { addCar } from './cars'
import { addEntry } from './entries'
import { setSetting, getSetting, SETTING_KEYS } from './settings'
import { describeImport, exportData, importData, parseBackup } from './backup'
import { addVehicleDocument, vehicleDocuments } from './attachments'

beforeEach(async () => {
  await Promise.all([
    db.cars.clear(),
    db.entries.clear(),
    db.settings.clear(),
    db.tyreSets.clear(),
    db.attachments.clear(),
    // Was missing: reminders leaked between tests in this file.
    db.reminders.clear(),
  ])
})

describe('backup', () => {
  it('round-trips cars, entries and settings', async () => {
    const car = await addCar({ make: 'Škoda', model: 'Octavia', year: 2018, odometer: 155650 })
    await addEntry({
      carId: car.id,
      category: 'fuel',
      date: '2026-07-15',
      odometer: 155650,
      cost: 68.5,
      litres: 45.3,
      fullTank: true,
    })
    await setSetting(SETTING_KEYS.aiModel, 'claude-haiku-4-5')

    const backup = parseBackup(JSON.stringify(await exportData()))

    await Promise.all([db.cars.clear(), db.entries.clear(), db.settings.clear()])
    await importData(backup)

    expect(await db.cars.count()).toBe(1)
    expect((await db.cars.get(car.id))?.model).toBe('Octavia')
    expect(await db.entries.count()).toBe(1)
    expect(await getSetting(SETTING_KEYS.aiModel)).toBe('claude-haiku-4-5')
  })

  it('never exports or imports the API key', async () => {
    await setSetting(SETTING_KEYS.aiApiKey, 'sk-ant-secret')
    const backup = await exportData()
    expect(JSON.stringify(backup)).not.toContain('sk-ant-secret')

    backup.settings.push({ key: SETTING_KEYS.aiApiKey, value: 'sk-ant-injected' })
    await db.settings.clear()
    await importData(backup)
    expect(await getSetting(SETTING_KEYS.aiApiKey)).toBeUndefined()
  })

  it('import replaces existing data instead of merging', async () => {
    await addCar({ make: 'Old', model: 'Car', year: 2000, odometer: 1 })
    await importData({
      app: 'garagebook',
      version: 1,
      exportedAt: '',
      cars: [],
      entries: [],
      settings: [],
    })
    expect(await db.cars.count()).toBe(0)
  })

  it('rejects non-JSON, foreign files and unknown versions', () => {
    expect(() => parseBackup('not json')).toThrow('not valid JSON')
    expect(() => parseBackup('{"app":"other"}')).toThrow('does not look like')
    expect(() =>
      parseBackup('{"app":"garagebook","version":9,"cars":[],"entries":[]}'),
    ).toThrow('Unsupported backup version')
  })
})

describe('tyre sets in backups', () => {
  it('round-trips tyre sets through export and import', async () => {
    await db.tyreSets.clear()
    const set: TyreSet = {
      id: 'tyre-1',
      carId: 'car-1',
      season: 'winter',
      brand: 'Nokian',
      status: 'fitted',
      swapMonth: 10,
      treadReadings: [{ date: '2026-10-01', mm: 6.8 }],
      fittedPeriods: [{ fromDate: '2026-10-01', fromOdo: 148200 }],
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    }
    await db.tyreSets.add(set)

    const backup = await exportData()
    expect(backup.tyreSets).toEqual([set])

    await db.tyreSets.clear()
    await importData(backup)
    expect(await db.tyreSets.toArray()).toEqual([set])
  })

  it('imports a pre-tyres backup without failing', async () => {
    await db.tyreSets.add({
      id: 'stale',
      carId: 'car-1',
      season: 'summer',
      status: 'stored',
      treadReadings: [],
      fittedPeriods: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    const backup = await exportData()
    delete backup.tyreSets

    await importData(backup)
    expect(await db.tyreSets.toArray()).toEqual([])
  })
})

describe('attachments in backups', () => {
  const attachment = (id: string) => ({
    id,
    entryId: 'entry-1',
    carId: 'car-1',
    name: `${id}.jpg`,
    mime: 'image/jpeg',
    size: 4,
    bytes: new Uint8Array([1, 2, 250, 255]).buffer,
    createdAt: '2026-07-01T00:00:00.000Z',
  })

  beforeEach(async () => {
    await db.attachments.clear()
  })

  it('round-trips attachment bytes through export and import', async () => {
    await db.attachments.add(attachment('a1'))

    const backup = await exportData()
    expect(backup.version).toBe(3)
    expect(backup.attachments).toHaveLength(1)
    expect(backup.attachments![0]!.data).toBe('AQL6/w==')

    await db.attachments.clear()
    await importData(backup)

    const [restored] = await db.attachments.toArray()
    expect([...new Uint8Array(restored!.bytes)]).toEqual([1, 2, 250, 255])
    expect(restored!.name).toBe('a1.jpg')
  })

  it('omits photos when the owner exports without them', async () => {
    await db.attachments.add(attachment('a1'))
    const backup = await exportData(false)
    expect(backup.attachments).toBeUndefined()

    // Importing a photo-less backup must not leave stale blobs behind
    await importData(backup)
    expect(await db.attachments.toArray()).toHaveLength(0)
  })

  it('still imports a version 1 backup', async () => {
    const legacy = parseBackup(
      JSON.stringify({
        app: 'garagebook',
        version: 1,
        exportedAt: '2026-07-01T00:00:00.000Z',
        cars: [],
        entries: [],
        settings: [],
      }),
    )
    await db.attachments.add(attachment('a1'))
    await importData(legacy)
    expect(await db.attachments.toArray()).toHaveLength(0)
  })

  it('rejects a version it does not understand', () => {
    expect(() =>
      parseBackup(
        JSON.stringify({ app: 'garagebook', version: 4, cars: [], entries: [], settings: [] }),
      ),
    ).toThrow(/Unsupported backup version/)
  })
})

describe('backup carries vehicle documents', () => {
  it('round-trips a PZP with its bytes and its lack of an entry', async () => {
    const car = await addCar({ make: 'Yamaha', model: 'XT660', year: 2008, odometer: 41000 })
    await addVehicleDocument({
      carId: car.id,
      name: 'pzp.pdf',
      mime: 'application/pdf',
      size: 3,
      bytes: new Uint8Array([9, 8, 7]).buffer,
    })

    const backup = parseBackup(JSON.stringify(await exportData()))
    await Promise.all([db.cars.clear(), db.attachments.clear()])
    await importData(backup)

    const [restored] = await vehicleDocuments(car.id)
    expect(restored).toMatchObject({ name: 'pzp.pdf', mime: 'application/pdf' })
    expect(restored!.entryId).toBeUndefined()
    expect([...new Uint8Array(restored!.bytes)]).toEqual([9, 8, 7])
  })

  it('leaves it out when the owner exports without attachments', async () => {
    const car = await addCar({ make: 'Honda', model: 'SH125', year: 2025, odometer: 900 })
    await addVehicleDocument({
      carId: car.id,
      name: 'pzp.pdf',
      mime: 'application/pdf',
      size: 3,
      bytes: new Uint8Array([9, 8, 7]).buffer,
    })

    expect((await exportData(false)).attachments).toBeUndefined()
  })
})

// Selective export is only safe if a partial file cannot quietly destroy what
// it does not contain. That is what the v3 manifest is for.
describe('selective export', () => {
  async function garage() {
    const skoda = await addCar({ make: 'Škoda', model: 'Octavia', year: 2018, odometer: 155000 })
    const yamaha = await addCar({ make: 'Yamaha', model: 'MT-07', year: 2021, odometer: 18400 })
    await addEntry({ carId: skoda.id, category: 'fuel', date: '2026-07-01', odometer: 155000, cost: 60 })
    await addEntry({ carId: yamaha.id, category: 'fuel', date: '2026-07-02', odometer: 18400, cost: 20 })
    await db.reminders.add({
      id: `r-${skoda.id}`, carId: skoda.id, title: 'Service', dueDate: '2026-09-01',
      createdAt: '', updatedAt: '',
    })
    await db.tyreSets.add({
      id: `t-${yamaha.id}`, carId: yamaha.id, season: 'summer', status: 'fitted',
      treadReadings: [], fittedPeriods: [], createdAt: '', updatedAt: '',
    })
    return { skoda, yamaha }
  }

  it('exports only the chosen data types', async () => {
    await garage()
    const backup = await exportData({ tables: ['cars', 'entries'] })

    expect(backup.includes).toEqual(['cars', 'entries'])
    expect(backup.cars).toHaveLength(2)
    expect(backup.reminders).toBeUndefined()
    expect(backup.tyreSets).toBeUndefined()
  })

  it('leaves unexported tables alone on import instead of wiping them', async () => {
    const { skoda } = await garage()
    const backup = parseBackup(JSON.stringify(await exportData({ tables: ['cars'] })))

    await importData(backup)

    // The reminder and tyre set were not in the file, so they survive.
    expect(await db.reminders.count()).toBe(1)
    expect(await db.tyreSets.count()).toBe(1)
    expect(await db.entries.count()).toBe(2)
    expect((await db.cars.get(skoda.id))?.model).toBe('Octavia')
  })

  it('exports one vehicle and its data, and nothing of the others', async () => {
    const { yamaha } = await garage()
    const backup = await exportData({ carIds: [yamaha.id] })

    expect(backup.cars.map((c) => c.model)).toEqual(['MT-07'])
    expect(backup.entries).toHaveLength(1)
    expect(backup.entries[0]!.carId).toBe(yamaha.id)
    expect(backup.reminders).toHaveLength(0)
    expect(backup.tyreSets).toHaveLength(1)
    expect(backup.scope?.carIds).toEqual([yamaha.id])
  })

  // The trap: exporting one bike and importing it must not delete the car.
  it('merges a vehicle-scoped backup rather than replacing the garage', async () => {
    const { skoda, yamaha } = await garage()
    const backup = parseBackup(JSON.stringify(await exportData({ carIds: [yamaha.id] })))

    await db.cars.update(yamaha.id, { odometer: 99999 })
    await importData(backup)

    expect(await db.cars.count()).toBe(2)
    expect((await db.cars.get(skoda.id))?.model).toBe('Octavia')
    // The scoped vehicle is restored to its backed-up state
    expect((await db.cars.get(yamaha.id))?.odometer).toBe(18400)
    expect(await db.entries.count()).toBe(2)
  })

  it('still replaces wholesale for a full backup, as a restore should', async () => {
    await garage()
    const backup = parseBackup(JSON.stringify(await exportData()))

    await addCar({ make: 'Ghost', model: 'Car', year: 2000, odometer: 1 })
    await importData(backup)

    expect((await db.cars.toArray()).map((c) => c.make).sort()).toEqual(['Yamaha', 'Škoda'])
  })

  it('describes what an import will do before it does it', async () => {
    await garage()
    const full = await exportData()
    const scoped = await exportData({ carIds: ['car-x'], tables: ['cars', 'entries'] })

    expect(describeImport(full)).toMatchObject({ mode: 'replace', carIds: null })
    expect(describeImport(scoped)).toMatchObject({ mode: 'merge', carIds: ['car-x'] })
    expect(describeImport(scoped).tables).toEqual(['cars', 'entries'])
  })

  it('treats a v1/v2 file as the full-replace backup it always was', () => {
    const legacy = parseBackup(
      JSON.stringify({
        app: 'garagebook', version: 2, exportedAt: '2026-07-01T00:00:00.000Z',
        cars: [], entries: [], settings: [],
      }),
    )
    const plan = describeImport(legacy)
    expect(plan.mode).toBe('replace')
    expect(plan.tables).toContain('attachments')
    expect(plan.tables).toContain('reminders')
  })
})
