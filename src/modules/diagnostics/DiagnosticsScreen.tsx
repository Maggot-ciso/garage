import { useLiveQuery } from 'dexie-react-hooks'
import { resolveActiveCar } from '../../db/activeCar'
import { usesBlinkCodes } from '../../data/blinkCodes'
import { ObdPanel } from './ObdPanel'
import { BlinkCodePanel } from './BlinkCodePanel'
import { DashboardLightPanel } from './DashboardLightPanel'

// Deterministic diagnostics — code lookup and the dashboard warning-light
// decoder. Both are offline table lookups (no AI, no key, no network), so this
// whole screen works with nothing configured. When a code needs judgement about
// what to do, `onAskAI` hands the question to the AI assistant on its own tab.
//
// The panels follow the active vehicle: a Euro-4-or-later bike answers to the
// same generic P-codes a car does, but a scooter may have no socket at all and
// report faults by flashing its lamp instead — and neither has a door-ajar lamp.
export function DiagnosticsScreen({ onAskAI }: { onAskAI: (prompt: string) => void }) {
  const car = useLiveQuery(async () => (await resolveActiveCar()).car ?? null, [])

  if (car === undefined) return null

  return (
    <div className="flex flex-col gap-4">
      <ObdPanel onAsk={onAskAI} vehicleType={car?.vehicleType} />
      {car && usesBlinkCodes(car.vehicleType) && <BlinkCodePanel car={car} onAsk={onAskAI} />}
      <DashboardLightPanel vehicleType={car?.vehicleType} />
    </div>
  )
}
