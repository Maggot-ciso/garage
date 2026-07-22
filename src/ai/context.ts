import type { Attachment, Car, LogEntry, Reminder, TyreSet } from '../db/db'
import { currentOdometer } from '../modules/reminders/reminderLogic'
import { kmOnSet, latestTread, setLabel } from '../modules/tyres/tyreLogic'
import { comparisonSitesFor } from '../data/insuranceComparison'
import { detectRegion, shippingRule, type Region } from './region'

// Recent entries go in verbatim; everything older is rolled up. The full
// context is re-sent on every reply, so density matters more than volume —
// twelve years of fill-ups listed one per line would crowd out the answer.
const RECENT_ENTRIES = 20

export interface CarContextInput {
  car: Car
  entries: LogEntry[]
  reminders: Reminder[]
  tyreSets?: TyreSet[]
  /** The rest of the garage, so "which of mine is cheapest per km" is answerable. */
  otherCars?: Car[]
  /** Metadata only — the assistant should know a PZP exists, never read its bytes. */
  documents?: Pick<Attachment, 'name' | 'createdAt'>[]
}

// Everything the assistant should know about this vehicle, rebuilt fresh on
// every request so it is never stale. Pure function — unit-tested.
export function buildCarContext(input: CarContextInput): string {
  const { car, entries, reminders, tyreSets = [], otherCars = [], documents = [] } = input
  const carEntries = entries
    .filter((e) => e.carId === car.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const odometer = currentOdometer(car, entries)

  // A motorcycle needs different advice from a car — chain vs belt, tyre wear,
  // service intervals — so the label leads with what it actually is.
  const kind = car.vehicleType === 'motorcycle' ? 'Motorcycle/scooter' : 'Car'
  const lines: string[] = [
    `${kind}: ${car.year} ${car.make} ${car.model}`,
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

  const carTyres = tyreSets.filter((t) => t.carId === car.id)
  if (carTyres.length > 0) {
    lines.push('', 'Tyre sets:')
    for (const set of carTyres) {
      const tread = latestTread(set)
      const bits = [
        set.status === 'fitted' ? 'fitted now' : `stored${set.storageLocation ? ` (${set.storageLocation})` : ''}`,
        set.size ? set.size : null,
        tread ? `${tread.mm} mm tread measured ${tread.date}` : 'no tread reading',
        set.status === 'fitted' ? `${kmOnSet(set, odometer).toLocaleString('en-US')} km on this set` : null,
      ].filter(Boolean)
      lines.push(`- ${setLabel(set)}: ${bits.join(', ')}`)
    }
  }

  if (documents.length > 0) {
    // Names and dates only. The bytes stay in IndexedDB — the assistant should
    // be able to say "your PZP is on file", not read the certificate.
    lines.push(
      '',
      `Documents on file for this vehicle: ${documents
        .map((d) => `${d.name} (added ${d.createdAt.slice(0, 10)})`)
        .join(', ')}`,
    )
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
    const recent = carEntries.slice(0, RECENT_ENTRIES)
    lines.push('', `Last ${recent.length} logbook entries:`)
    for (const e of recent) lines.push(`- ${describeEntry(e)}`)

    const older = carEntries.slice(RECENT_ENTRIES)
    if (older.length > 0) {
      lines.push('', `Earlier history (${older.length} older entries), rolled up by year:`)
      for (const line of rollUp(older)) lines.push(`- ${line}`)
    }
  } else {
    lines.push('', 'The logbook has no entries yet.')
  }

  const others = otherCars.filter((c) => c.id !== car.id)
  if (others.length > 0) {
    lines.push(
      '',
      `Other vehicles in this garage (ask before assuming a question is about them): ${others
        .map((c) => `${c.year} ${c.make} ${c.model}`)
        .join('; ')}`,
    )
  }

  return lines.join('\n')
}

// company and items matter for "who last did the brakes" and "what did that
// service actually include" — both dead ends without them.
function describeEntry(e: LogEntry): string {
  const fuel =
    e.category === 'fuel' && e.litres !== undefined
      ? `, ${e.litres} L${e.fullTank ? ' full' : ' partial'}`
      : ''
  const items = e.items?.length
    ? ` [${e.items.map((i) => `${i.name} ${i.price.toFixed(2)}€`).join('; ')}]`
    : ''
  return (
    `${e.date} ${e.category}: ${e.cost.toFixed(2)}€ at ${e.odometer.toLocaleString('en-US')} km` +
    `${fuel}${e.company ? ` at ${e.company}` : ''}${e.notes ? ` — ${e.notes}` : ''}${items}`
  )
}

// One line per year: what was spent on what, and how far the vehicle got.
// Keeps twelve years of history affordable while staying true.
interface YearBucket {
  totals: Map<string, { n: number; cost: number }>
  odos: number[]
}

function rollUp(entries: LogEntry[]): string[] {
  const years = new Map<string, YearBucket>()
  for (const e of entries) {
    const year = e.date.slice(0, 4)
    const bucket: YearBucket = years.get(year) ?? { totals: new Map(), odos: [] }
    const cell = bucket.totals.get(e.category) ?? { n: 0, cost: 0 }
    cell.n += 1
    cell.cost += e.cost
    bucket.totals.set(e.category, cell)
    if (e.odometer > 0) bucket.odos.push(e.odometer)
    years.set(year, bucket)
  }

  return [...years.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, { totals, odos }]) => {
      const parts = [...totals.entries()]
        .sort((a, b) => b[1].cost - a[1].cost)
        .map(([category, { n, cost }]) => `${category} ×${n} ${cost.toFixed(2)}€`)
      const span =
        odos.length > 1
          ? `, odometer ${Math.min(...odos).toLocaleString('en-US')}–${Math.max(...odos).toLocaleString('en-US')} km`
          : ''
      return `${year}: ${parts.join(', ')}${span}`
    })
}

// The two search abilities are prompt rules rather than tables because both
// answers are live: which dealer is open and what a policy costs this month.
// A shipped list of addresses or prices would be confidently wrong within weeks
// — the same reason the VIN decoder declines rather than guesses.
function serviceCentreRule(region: Region | null): string {
  const where = region ? ` The driver is in ${region.name}.` : ''
  return `- Finding an authorised service centre: you do not know where the driver is beyond the country.${where} Ask for their town or district before searching, then use web_search for the manufacturer's own dealer/service locator for that make and area. Never invent a dealer name, address, phone number or opening hours, and never state one from memory — give only what a search result actually supports, with the link. Say plainly that you cannot confirm a centre is currently open or still authorised, and that a phone call before driving there is worth it. An independent specialist is often the better value out of warranty; say so when it is true.`
}

function insuranceRule(region: Region | null): string {
  const sites = comparisonSitesFor(region?.code)
  const listed = sites.length
    ? ` Point them at the comparators rather than a single insurer: ${sites
        .map((s) => `${s.name} (${s.url}) — ${s.note}`)
        .join('; ')}.`
    : ' Point them at an independent comparison calculator for their country rather than a single insurer, and use web_search to find one.'
  return `- PZP (povinné zmluvné poistenie, the mandatory third-party cover) and havarijná poistka (optional comprehensive): you cannot know what either costs this driver.${listed} A premium depends on age, licence and claims history, bonus/malus, region and the vehicle, so never quote a figure as their price, and never present a remembered price as current — run a search if they want a ballpark and say what it is based on. Remind them the cheapest PZP is not automatically the best: coverage limits, assistance and claims handling differ. If the vehicle already has a policy document on file, mention it is there.`
}

export function agentSystemPrompt(context: string, language: 'en' | 'sk' = 'en'): string {
  const region = detectRegion()
  return `You are GarageBook's assistant — a knowledgeable vehicle-maintenance advisor built into a logbook app. You are talking to the driver/rider of this vehicle:

${context}

Rules:
- Use the vehicle's real history above when relevant (e.g. relate symptoms to recent work, note overdue maintenance). The history is complete: recent entries verbatim, older ones summarised by year. If you need an older entry in full, use search_logbook rather than guessing.
- You are guidance, never a definitive diagnosis. For anything safety-critical or uncertain, frame possibilities as questions to discuss with a mechanic.
- For parts: give the exact part name and spec for this exact vehicle and engine (OEM numbers when confident), and mention decent aftermarket brands.
${shippingRule(region)}
${serviceCentreRule(region)}
${insuranceRule(region)}
- You have tools to search the logbook and to add entries, add reminders, or update the odometer. Use them when the driver asks or clearly implies it. Every change requires the driver's in-app confirmation, so propose them freely but never claim something was saved unless the tool result says so.
${
    language === 'sk'
      ? '- Odpovedaj po slovensky. Názvy dielov, kódy OBD a označenia motorov nechaj v pôvodnom tvare (často anglicky alebo nemecky), pretože presne tak sú v katalógoch dielov — neprekladaj ich.'
      : '- Answer in English.'
  }
- Keep answers concise and readable on a phone. Metric units, prices in €.`
}
