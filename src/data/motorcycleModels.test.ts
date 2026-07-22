import { describe, expect, it } from 'vitest'
import { makesForVehicleType, modelsForVehicle } from './carModels'

describe('vehicle-type-aware make lists', () => {
  it('never offers a car make for a motorcycle', () => {
    const makes = makesForVehicleType('motorcycle')
    // The reported bug: Škoda offered when adding a scooter.
    expect(makes).not.toContain('Škoda')
    expect(makes).not.toContain('Volkswagen')
    expect(makes).toContain('Yamaha')
    expect(makes).toContain('Vespa')
  })

  it('never offers a motorcycle-only make for a car', () => {
    const makes = makesForVehicleType('car')
    expect(makes).not.toContain('Vespa')
    expect(makes).not.toContain('KTM')
    expect(makes).toContain('Škoda')
  })

  it('covers both test vehicles the owner supplied', () => {
    // Yamaha MT-07 (motorcycle) and a Honda scooter
    expect(modelsForVehicle('motorcycle', 'Yamaha')).toContain('MT-07')
    expect(modelsForVehicle('motorcycle', 'Honda')).toContain('SH125i')
  })

  it('returns models per type, not mixed', () => {
    // BMW makes both; each list must stay in its own lane.
    expect(modelsForVehicle('motorcycle', 'BMW')).toContain('R 1250 GS')
    expect(modelsForVehicle('car', 'BMW')).not.toContain('R 1250 GS')
    expect(modelsForVehicle('motorcycle', 'Škoda')).toEqual([])
  })
})
