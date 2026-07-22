import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { Lightbulb } from 'lucide-react'
import type { Car } from '../../db/db'
import { blinkCode, schemeForMake } from '../../data/blinkCodes'

// The counting is deterministic and offline; the meaning is not ours to claim.
// Honda's own manual documents the flash arithmetic but the number→fault table
// differs per model, so this turns the lamp into a number and then hands that
// number to the assistant rather than inventing a fault.
export function BlinkCodePanel({ car, onAsk }: { car: Car; onAsk?: (prompt: string) => void }) {
  const t = useT()
  const [long, setLong] = useState(0)
  const [short, setShort] = useState(0)
  const scheme = schemeForMake(car.make)

  if (!scheme) {
    return (
      <section className="flex flex-col gap-2">
        <Header />
        <p className="faint text-sm">
          {t('blink.noScheme', { make: car.make })}
        </p>
      </section>
    )
  }

  if (scheme.method === 'dash-menu') {
    return (
      <section className="flex flex-col gap-2">
        <Header />
        <div className="card flex flex-col gap-1 p-3">
          <p className="text-sm">{scheme.howToRead}</p>
          <p className="faint text-sm">{scheme.whereItsDefined}</p>
        </div>
      </section>
    )
  }

  const code = blinkCode(long, short, scheme)

  return (
    <section className="flex flex-col gap-2">
      <Header />
      <p className="muted text-sm">{scheme.howToRead}</p>

      <div className="grid grid-cols-2 gap-3">
        <Counter label={t('blink.longFlashes')} value={long} onChange={setLong} />
        <Counter label={t('blink.shortFlashes')} value={short} onChange={setShort} />
      </div>

      {code !== null && (
        <div className="card flex flex-col gap-1 p-3">
          <div className="text-lg font-bold tracking-tight">{t('blink.code', { code })}</div>
          <div className="faint text-sm">
            {t('blink.meaningUnknown', { make: car.make, model: car.model })}{' '}
            {scheme.whereItsDefined}
          </div>
          {onAsk && (
            <button
              type="button"
              onClick={() =>
                onAsk(
                  `My ${car.year} ${car.make} ${car.model} is flashing FI fault code ${code} ` +
                    `(${long} long, ${short} short). What does code ${code} mean on this exact model, ` +
                    `what should I check, and how urgent is it?`,
                )
              }
              className="link-accent mt-1 self-start"
            >
              {t('blink.lookUp')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function Header() {
  const t = useT()
  return (
    <div className="flex items-center gap-2">
      <Lightbulb className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
      <h2 className="section-title">{t('blink.title')}</h2>
    </div>
  )
}

function Counter({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  const t = useT()
  return (
    <div className="card flex flex-col gap-2 p-3">
      <span className="label">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={t('blink.a11yFewer', { label: label.toLowerCase() })}
          className="h-9 w-9 shrink-0 rounded-xl border border-slate-300 text-lg dark:border-slate-700"
        >
          −
        </button>
        <span className="flex-1 text-center text-xl font-bold tabular-nums">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={t('blink.a11yMore', { label: label.toLowerCase() })}
          className="h-9 w-9 shrink-0 rounded-xl border border-slate-300 text-lg dark:border-slate-700"
        >
          +
        </button>
      </div>
    </div>
  )
}
