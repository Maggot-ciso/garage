import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, type TyreSet } from './db'
import { addCar } from './cars'
import { addEntry } from './entries'
import { setSetting, getSetting, SETTING_KEYS } from './settings'
import { exportData, importData, parseBackup } from './backup'

beforeEach(async () => {
  await Promise.all([
    db.cars.clear(),
    db.entries.clear(),
    db.settings.clear(),
    db.tyreSets.clear(),
    db.attachments.clear(),
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
    expect(backup.version).toBe(2)
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
        JSON.stringify({ app: 'garagebook', version: 3, cars: [], entries: [], settings: [] }),
      ),
    ).toThrow(/Unsupported backup version/)
  })
})
