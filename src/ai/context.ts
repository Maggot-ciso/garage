import type { Car, LogEntry, Reminder } from '../db/db'
import { currentOdometer } from '../modules/reminders/reminderLogic'

const RECENT_ENTRIES = 20

// Everything the assistant should know about this car, rebuilt fresh on
// every request so it is never stale. Pure function — unit-tested.
export function buildCarContext(car: Car, entries: LogEntry[], reminders: Reminder[]): string {
  const carEntries = entries
    .filter((e) => e.carId === car.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const odometer = currentOdometer(car, entries)

  const lines: string[] = [
    `Car: ${car.year} ${car.make} ${car.model}`,
    ...(car.engine ? [`Engine: ${car.engine}`] : []),
    ...(car.vin ? [`VIN: ${car.vin}`] : []),
    `Current odometer: ${odometer.toLocaleString('en-US')} km`,
  ]

  const open = reminders.filter((r) => r.carId === car.id && !r.completedAt)
  if (open.length > 0) {
    lines.push('', 'Open maintenance reminders:')
    for (const r of open) {
      const due = [
        r.dueOdometer !== undefined ? `at ${r.dueOdometer.toLocaleString('en-US')} km` : null,
        r.dueDate ? `by ${r.dueDate}` : null,
      ]
        .filter(Boolean)
        .join(' or ')
      lines.push(`- ${r.title} (${due})${r.notes ? ` — ${r.notes}` : ''}`)
    }
  }

  const totals = new Map<string, number>()
  for (const e of carEntries) totals.set(e.category, (totals.get(e.category) ?? 0) + e.cost)
  if (totals.size > 0) {
    lines.push(
      '',
      `Lifetime costs (${carEntries.length} entries): ` +
        [...totals.entries()].map(([c, t]) => `${c} ${t.toFixed(2)}€`).join(', '),
    )
  }

  if (carEntries.length > 0) {
    lines.push('', `Last ${Math.min(RECENT_ENTRIES, carEntries.length)} logbook entries:`)
    for (const e of carEntries.slice(0, RECENT_ENTRIES)) {
      const fuel =
        e.category === 'fuel' && e.litres !== undefined
          ? `, ${e.litres} L${e.fullTank ? ' full' : ' partial'}`
          : ''
      lines.push(
        `- ${e.date} ${e.category}: ${e.cost.toFixed(2)}€ at ${e.odometer.toLocaleString('en-US')} km${fuel}${e.notes ? ` — ${e.notes}` : ''}`,
      )
    }
  } else {
    lines.push('', 'The logbook has no entries yet.')
  }

  return lines.join('\n')
}

export function agentSystemPrompt(context: string): string {
  return `You are GarageBook's assistant — a knowledgeable car-maintenance advisor built into the owner's logbook app. You are talking to the owner of this car:

${context}

Rules:
- Use the car's real history above when relevant (e.g. relate symptoms to recent work, note overdue maintenance).
- You are guidance, never a definitive diagnosis. For anything safety-critical or uncertain, frame possibilities as questions to discuss with a mechanic.
- For parts: give the exact part name and spec for this exact car and engine (OEM numbers when confident), and mention decent aftermarket brands.
- The owner is in Slovakia (EU). Only recommend places to buy that ship to the EU. US retailers are fine when they ship internationally — RockAuto (rockauto.com) is a good example and is often the better source for a US-market car like a Hyundai Genesis Coupe; prefer EU retailers (e.g. Autodoc) for EU-market cars like a Škoda. Judge which fits from the car above. Give direct product links where you can, and always remind the owner to confirm EU shipping — and any customs or VAT on US orders — at checkout, since you cannot verify live shipping or stock.
- You have tools to search the logbook and to add entries, add reminders, or update the odometer. Use them when the owner asks or clearly implies it. Every change requires the owner's in-app confirmation, so propose them freely but never claim something was saved unless the tool result says so.
- Keep answers concise and readable on a phone. Metric units, prices in €.`
}
