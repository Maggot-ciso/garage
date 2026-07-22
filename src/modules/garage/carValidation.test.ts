import { describe, expect, it } from 'vitest'
import { validateCar, type CarFormValues } from './carValidation'

const valid: CarFormValues = {
  make: 'Škoda',
  model: 'Octavia',
  year: '2018',
  engine: '2.0 TDI',
  vin: 'TMBJJ7NE4J0123456',
  odometer: '154000',
}

describe('validateCar', () => {
  it('accepts a fully valid car', () => {
    const result = validateCar(valid)
    expect(result.errors).toEqual({})
    expect(result.fields).toEqual({
      make: 'Škoda',
      model: 'Octavia',
      year: 2018,
      engine: '2.0 TDI',
      vin: 'TMBJJ7NE4J0123456',
      odometer: 154000,
    })
  })

  it('accepts empty optional fields and omits them', () => {
    const result = validateCar({ ...valid, engine: '', vin: '' })
    expect(result.fields).not.toHaveProperty('engine')
    expect(result.fields).not.toHaveProperty('vin')
  })

  it('trims whitespace and uppercases VIN', () => {
    const result = validateCar({ ...valid, make: '  BMW ', vin: ' tmbjj7ne4j0123456 ' })
    expect(result.fields?.make).toBe('BMW')
    expect(result.fields?.vin).toBe('TMBJJ7NE4J0123456')
  })

  it('requires make, model, year and odometer', () => {
    const result = validateCar({ make: '', model: ' ', year: '', engine: '', vin: '', odometer: '' })
    expect(result.fields).toBeUndefined()
    expect(Object.keys(result.errors).sort()).toEqual(['make', 'model', 'odometer', 'year'])
  })

  it('rejects out-of-range or non-integer years', () => {
    expect(validateCar({ ...valid, year: '1899' }).errors.year).toBeDefined()
    expect(validateCar({ ...valid, year: String(new Date().getFullYear() + 2) }).errors.year).toBeDefined()
    expect(validateCar({ ...valid, year: '2018.5' }).errors.year).toBeDefined()
    expect(validateCar({ ...valid, year: 'abc' }).errors.year).toBeDefined()
  })

  it('rejects negative or non-numeric odometer', () => {
    expect(validateCar({ ...valid, odometer: '-1' }).errors.odometer).toBeDefined()
    expect(validateCar({ ...valid, odometer: 'abc' }).errors.odometer).toBeDefined()
    expect(validateCar({ ...valid, odometer: '0' }).errors.odometer).toBeUndefined()
  })

  it('rejects malformed VINs but allows short pre-1981 style VINs', () => {
    expect(validateCar({ ...valid, vin: 'ABC' }).errors.vin).toBeDefined()
    expect(validateCar({ ...valid, vin: 'ABCDEFGH1234IOQ56' }).errors.vin).toBeDefined()
    expect(validateCar({ ...valid, vin: 'ABCDEFGH123' }).errors.vin).toBeUndefined()
  })
})
