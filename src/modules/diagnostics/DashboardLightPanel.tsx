import type { VehicleType } from '../../db/db'
import { useT } from '../../i18n/I18nProvider'
import type { TranslationKey } from '../../i18n/en'
import { useState } from 'react'
import { AlertTriangle, ChevronLeft, Gauge } from 'lucide-react'
import type { DashboardLight, LightColour, Severity } from '../../data/dashboardLights'
import {
  COLOUR_ORDER,
  colourCounts,
  lightsOfColour,
} from './dashboardLights'

// currentColor drives the SVG, so each colour tier just sets a text colour.
const COLOUR_TEXT: Record<LightColour, string> = {
  red: 'text-red-600 dark:text-red-400',
  amber: 'text-amber-600 dark:text-amber-400',
  info: 'text-sky-600 dark:text-sky-400',
}
const COLOUR_SWATCH: Record<LightColour, string> = {
  red: 'bg-red-500',
  amber: 'bg-amber-400',
  info: 'bg-sky-500',
}
const SEVERITY_LABEL: Record<Severity, string> = {
  stop: 'Stop / act now',
  soon: 'Get it checked soon',
  note: 'Good to know',
}

function LightGlyph({ light, className }: { light: DashboardLight; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: light.svg }}
    />
  )
}

export function DashboardLightPanel({ vehicleType }: { vehicleType?: VehicleType }) {
  const t = useT()
  const [colour, setColour] = useState<LightColour | null>(null)
  const [light, setLight] = useState<DashboardLight | null>(null)
  const counts = colourCounts(vehicleType)

  // Detail view
  if (light) {
    return (
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setLight(null)}
          className="link-accent flex items-center gap-1 self-start"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden /> {t('action.back')}
        </button>
        <div className="card flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            <LightGlyph light={light} className={`h-10 w-10 shrink-0 ${COLOUR_TEXT[light.colour]}`} />
            <div>
              <div className="font-bold tracking-tight">{t(`light.${light.id}.name` as TranslationKey)}</div>
              <div className="muted text-sm">{SEVERITY_LABEL[light.severity]}</div>
            </div>
          </div>
          <p className="text-sm">{t(`light.${light.id}.meaning` as TranslationKey)}</p>
          <p className="text-sm">
            <span className="font-medium">{t('diag.whatToDo')}</span>
            {t(`light.${light.id}.whatToDo` as TranslationKey)}
          </p>
        </div>
        <p className="faint text-xs">{t('diag.disclaimer')}</p>
      </section>
    )
  }

  // Grid of one colour's symbols
  if (colour) {
    return (
      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setColour(null)}
          className="link-accent flex items-center gap-1 self-start"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden /> {t('diag.colours')}
        </button>
        <h2 className="section-title flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full ${COLOUR_SWATCH[colour]}`} />
          {t('diag.colourLights', { colour: t(`colour.${colour}` as TranslationKey) })}
        </h2>
        <ul className="grid grid-cols-3 gap-2">
          {lightsOfColour(colour, vehicleType).map((l) => (
            <li key={l.id}>
              <button
                type="button"
                onClick={() => setLight(l)}
                className="card-tap flex h-full w-full flex-col items-center gap-1.5 p-3 text-center"
              >
                <LightGlyph light={l} className={`h-8 w-8 ${COLOUR_TEXT[l.colour]}`} />
                <span className="text-xs leading-tight">{t(`light.${l.id}.name` as TranslationKey)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )
  }

  // Colour picker
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Gauge className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <h2 className="section-title">{t('diag.warningLight')}</h2>
      </div>
      <p className="faint text-sm">{t('diag.pickColour')}</p>
      <div className="flex flex-col gap-2">
        {COLOUR_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColour(c)}
            className="card-tap flex items-center gap-3 p-3 text-left"
          >
            <span className={`h-4 w-4 shrink-0 rounded-full ${COLOUR_SWATCH[c]}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{t(`colour.${c}` as TranslationKey)}</span>
              <span className="faint text-sm">{t(`colourHint.${c}` as TranslationKey)}</span>
            </span>
            <span className="muted text-sm">{counts[c]}</span>
          </button>
        ))}
      </div>
      <p className="faint text-xs flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" strokeWidth={2} aria-hidden />
        {t('diag.commonOnly')}
      </p>
    </section>
  )
}
