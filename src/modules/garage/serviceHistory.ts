import type { Car, EntryCategory, LogEntry } from '../../db/db'

// A logbook earns its keep at sale time: a credible, complete record of what has
// been done to the car. This turns the data already stored into a shareable
// history. Pure string-building — no DOM, no I/O — so it is fully testable and
// the delivery layer stays thin.

// Fuel is left out of the maintenance record: a buyer or mechanic cares about
// what was serviced, repaired and replaced, not every tank.
const RECORD_CATEGORIES: EntryCategory[] = ['service', 'repair', 'tyres', 'insurance', 'other']

const CATEGORY_TITLE: Record<EntryCategory, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repair',
  tyres: 'Tyres',
  insurance: 'Insurance',
  other: 'Other',
}

export interface HistoryRecord {
  date: string
  category: EntryCategory
  categoryLabel: string
  odometer: number
  cost: number
  notes?: string
}

export interface ServiceHistory {
  title: string
  subtitle: string
  vin?: string
  generatedOn: string
  odometer: number
  records: HistoryRecord[]
  totalRecordedCost: number
  fuelSpend: number
  recordCount: number
}

export function buildServiceHistory(car: Car, entries: LogEntry[], todayISO: string): ServiceHistory {
  const forCar = entries.filter((e) => e.carId === car.id)
  const odometer = forCar.reduce((max, e) => Math.max(max, e.odometer), car.odometer)

  const records: HistoryRecord[] = forCar
    .filter((e) => RECORD_CATEGORIES.includes(e.category))
    .sort((a, b) => b.date.localeCompare(a.date) || b.odometer - a.odometer)
    .map((e) => ({
      date: e.date,
      category: e.category,
      categoryLabel: CATEGORY_TITLE[e.category],
      odometer: e.odometer,
      cost: e.cost,
      ...(e.notes ? { notes: e.notes } : {}),
    }))

  const totalRecordedCost = records.reduce((sum, r) => sum + r.cost, 0)
  const fuelSpend = forCar
    .filter((e) => e.category === 'fuel')
    .reduce((sum, e) => sum + e.cost, 0)

  const specs = [car.year, car.engine].filter(Boolean).join(' · ')

  return {
    title: `${car.make} ${car.model}`,
    subtitle: specs,
    ...(car.vin ? { vin: car.vin } : {}),
    generatedOn: todayISO,
    odometer,
    records,
    totalRecordedCost: round(totalRecordedCost),
    fuelSpend: round(fuelSpend),
    recordCount: records.length,
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

function money(n: number): string {
  return `${n.toFixed(2)} €`
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// A self-contained, printable document — no external assets, so it works
// offline and prints (or "saves as PDF") identically on desktop and iOS.
export function historyToHtml(h: ServiceHistory): string {
  const rows = h.records
    .map(
      (r) => `<tr>
      <td>${r.date}</td>
      <td>${r.categoryLabel}</td>
      <td class="num">${r.odometer.toLocaleString()} km</td>
      <td class="num">${money(r.cost)}</td>
      <td>${r.notes ? escapeHtml(r.notes) : ''}</td>
    </tr>`,
    )
    .join('\n')

  const empty = `<p class="empty">No service, repair or tyre records logged yet.</p>`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(h.title)} — service history</title>
<style>
  :root { color-scheme: light; }
  body { font: 15px/1.5 -apple-system, system-ui, sans-serif; color: #111; margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 2px; }
  .sub { color: #555; margin: 0 0 16px; }
  .meta { display: flex; flex-wrap: wrap; gap: 8px 20px; margin: 0 0 20px; font-size: 14px; }
  .meta b { color: #000; }
  .vin { font-family: ui-monospace, monospace; }
  .scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 440px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e3e3e3; vertical-align: top; }
  th { background: #f6f6f6; font-weight: 600; }
  .num { text-align: right; white-space: nowrap; }
  .empty { color: #777; font-style: italic; }
  .foot { margin-top: 20px; color: #888; font-size: 12px; }
  @media print { body { padding: 0; } .scroll { overflow: visible; } table { min-width: 0; } th { background: #eee !important; -webkit-print-color-adjust: exact; } }
</style></head><body>
  <h1>${escapeHtml(h.title)}</h1>
  <p class="sub">${escapeHtml(h.subtitle)}</p>
  <div class="meta">
    ${h.vin ? `<span><b>VIN</b> <span class="vin">${escapeHtml(h.vin)}</span></span>` : ''}
    <span><b>Odometer</b> ${h.odometer.toLocaleString()} km</span>
    <span><b>Records</b> ${h.recordCount}</span>
    <span><b>Service spend</b> ${money(h.totalRecordedCost)}</span>
  </div>
  ${h.records.length ? `<div class="scroll"><table>
    <thead><tr><th>Date</th><th>Type</th><th class="num">Odometer</th><th class="num">Cost</th><th>Details</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table></div>` : empty}
  <p class="foot">Generated by GarageBook on ${h.generatedOn}. Fuel excluded; service, repair, tyre and insurance records only.</p>
</body></html>`
}

// Plain-text form for the share sheet / clipboard, where HTML would be noise.
export function historyToText(h: ServiceHistory): string {
  const lines: string[] = [
    `${h.title}${h.subtitle ? ` (${h.subtitle})` : ''} — service history`,
    h.vin ? `VIN: ${h.vin}` : '',
    `Odometer: ${h.odometer.toLocaleString()} km · ${h.recordCount} records · ${money(h.totalRecordedCost)} on service`,
    '',
  ].filter(Boolean)

  if (h.records.length === 0) {
    lines.push('No service, repair or tyre records logged yet.')
  } else {
    for (const r of h.records) {
      const note = r.notes ? ` — ${r.notes}` : ''
      lines.push(`${r.date}  ${r.categoryLabel} @ ${r.odometer.toLocaleString()} km  ${money(r.cost)}${note}`)
    }
  }
  lines.push('', `Generated by GarageBook on ${h.generatedOn}.`)
  return lines.join('\n')
}
