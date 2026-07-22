import type { Car } from '../db/db'
import { setActiveCar } from '../db/activeCar'

// Shown only with 2+ cars; changing it switches the active car everywhere.
export function CarPicker({ cars, car }: { cars: Car[]; car: Car | undefined }) {
  if (cars.length < 2) return null
  return (
    <select
      value={car?.id}
      onChange={(e) => void setActiveCar(e.target.value)}
      className="input"
    >
      {cars.map((c) => (
        <option key={c.id} value={c.id}>
          {c.make} {c.model}
        </option>
      ))}
    </select>
  )
}
