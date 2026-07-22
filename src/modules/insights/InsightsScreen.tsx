import { useLiveQuery } from 'dexie-react-hooks'
import { useT } from '../../i18n/I18nProvider'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { TrendingUp } from 'lucide-react'
import { entriesForCar } from '../../db/entries'
import { resolveActiveCar } from '../../db/activeCar'
import { CarPicker } from '../../components/CarPicker'
import { CategoryTag } from '../../components/categoryIcons'
import {
  averageEconomy,
  costByCategory,
  costPerMonth,
  fuelEconomySeries,
  pricePerLitreSeries,
  projectedYearlyCost,
  spendPerKm,
  totalCost,
} from './calculations'

const ACCENT = '#dc2626' // red-600
const GRID = 'rgba(148, 163, 184, 0.25)' // legible on light and dark
const TICK = '#94a3b8'

// The projection is only as good as the window it's averaged over, so the
// card says what that window is instead of showing a bare number.
function describeSpan(days: number): string {
  if (days < 60) return `${days} days`
  const months = Math.round(days / 30)
  return months < 24 ? `${months} months` : `${Math.round(months / 12)} years`
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card p-3">
      <h2 className="label mb-2">{title}</h2>
      {children}
    </section>
  )
}

export function InsightsScreen() {
  const state = useLiveQuery(resolveActiveCar, [])
  const t = useT()
  const carId = state?.car?.id
  const entries = useLiveQuery(
    () => (carId ? entriesForCar(carId) : Promise.resolve([])),
    [carId],
  )

  if (state === undefined || entries === undefined) return null
  const { cars, car } = state

  // No cars at all — nothing to pick between, just prompt to add one.
  if (cars.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <TrendingUp className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
        <h2 className="text-base font-semibold">{t('insights.nothingYet')}</h2>
        <p className="muted max-w-xs text-sm">
          {t('insights.needCar')}
        </p>
      </div>
    )
  }

  // The active car has no entries yet — keep the picker so a car WITH data
  // is still reachable, then show the prompt below it.
  if (entries.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <CarPicker cars={cars} car={car} />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
          <TrendingUp className="faint h-10 w-10" strokeWidth={1.5} aria-hidden />
          <h2 className="text-base font-semibold">{t('insights.nothingYet')}</h2>
          <p className="muted max-w-xs text-sm">
            {cars.length > 1
              ? t('insights.needEntriesThisCar')
              : t('insights.needEntries')}
          </p>
        </div>
      </div>
    )
  }

  const economy = fuelEconomySeries(entries)
  const monthly = costPerMonth(entries)
  const byCategory = costByCategory(entries)
  const avg = averageEconomy(economy)
  const perKm = spendPerKm(entries)
  const fuelPrices = pricePerLitreSeries(entries)
  const projection = projectedYearlyCost(entries, new Date().toISOString().slice(0, 10))

  return (
    <div className="flex flex-col gap-3">
      <CarPicker cars={cars} car={car} />
      {cars.length > 1 && car && (
        <p className="muted -mt-1 text-sm">
          {car.year} {car.make} {car.model}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="muted text-sm">{t('insights.avgEconomy')}</div>
          <div className="text-xl font-bold tracking-tight">
            {avg !== null ? `${avg} L/100km` : '—'}
          </div>
        </div>
        <div className="card p-3">
          <div className="muted text-sm">{t('insights.totalSpent')}</div>
          <div className="text-xl font-bold tracking-tight">{totalCost(entries).toFixed(2)} €</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-3">
          <div className="muted text-sm">{t('insights.costPerKm')}</div>
          <div className="text-xl font-bold tracking-tight">
            {perKm !== null ? `${perKm.all.toFixed(2)} €` : '—'}
          </div>
          <div className="faint text-sm">
            {perKm !== null
              ? `${perKm.fuel.toFixed(2)} € fuel · ${perKm.distanceKm.toLocaleString()} km`
              : t('insights.needTwoMileages')}
          </div>
        </div>
        <div className="card p-3">
          <div className="muted text-sm">{t('insights.projectedYear')}</div>
          <div className="text-xl font-bold tracking-tight">
            {projection !== null ? `${Math.round(projection.perYear).toLocaleString()} €` : '—'}
          </div>
          <div className="faint text-sm">
            {projection !== null
              ? `${Math.round(projection.perMonth).toLocaleString()} € a month, from ${describeSpan(projection.daysObserved)} of logbook`
              : t('insights.needMonths')}
          </div>
        </div>
      </div>

      <Section title={t('insights.fuelPrice')}>
        {fuelPrices.length < 2 ? (
          <p className="muted text-sm">
            {t('insights.needTwoFills')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={fuelPrices} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: TICK }} stroke={GRID} />
              <YAxis
                tick={{ fontSize: 11, fill: TICK }}
                stroke={GRID}
                domain={['auto', 'auto']}
                tickFormatter={(v) => Number(v).toFixed(2)}
              />
              <Tooltip formatter={(v) => [`${Number(v).toFixed(3)} €/l`]} />
              <Line
                type="monotone"
                dataKey="eurPerLitre"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title={t('insights.fuelEconomy')}>
        {economy.length === 0 ? (
          <p className="muted text-sm">
            {t('insights.needTwoFullFills')}
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={economy} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: TICK }} stroke={GRID} />
              <YAxis tick={{ fontSize: 11, fill: TICK }} stroke={GRID} domain={['auto', 'auto']} />
              <Tooltip formatter={(v) => [`${v} L/100km`]} />
              <Line
                type="monotone"
                dataKey="lPer100km"
                stroke={ACCENT}
                strokeWidth={2}
                dot={{ r: 3, fill: ACCENT }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </Section>

      <Section title={t('insights.costPerMonth')}>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthly} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: TICK }} stroke={GRID} />
            <YAxis tick={{ fontSize: 11, fill: TICK }} stroke={GRID} />
            <Tooltip formatter={(v) => [`${Number(v).toFixed(2)} €`]} />
            <Bar dataKey="total" fill={ACCENT} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Section>

      <Section title={t('insights.costByCategory')}>
        <ul className="flex flex-col gap-2">
          {byCategory.map((row) => {
            const max = byCategory[0]!.total
            return (
              <li key={row.category} className="flex items-center gap-2">
                <CategoryTag category={row.category} className="muted w-28 shrink-0 text-sm" />
                <div className="h-4 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-4 rounded bg-red-600"
                    style={{ width: `${Math.max(4, (row.total / max) * 100)}%` }}
                  />
                </div>
                <span className="w-20 shrink-0 text-right text-sm font-medium">
                  {row.total.toFixed(2)} €
                </span>
              </li>
            )
          })}
        </ul>
      </Section>
    </div>
  )
}
