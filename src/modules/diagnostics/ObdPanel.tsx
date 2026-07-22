import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { ScanLine } from 'lucide-react'
import type { VehicleType } from '../../db/db'
import { describeLookup, lookupObd } from './obdLookup'

// Reading a code is a table lookup, not a language problem — so this works with
// no key, no network and no cost. The assistant is only offered afterwards, for
// the part that actually needs judgement: what to do about it.
export function ObdPanel({
  onAsk,
  vehicleType,
}: {
  onAsk?: (prompt: string) => void
  vehicleType?: VehicleType
}) {
  const [code, setCode] = useState('')
  const t = useT()
  const trimmed = code.trim()
  const result = trimmed ? lookupObd(trimmed) : null
  const unrecognised = trimmed.length >= 5 && result === null

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ScanLine className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <h2 className="section-title">{t('diag.obdTitle')}</h2>
      </div>

      {vehicleType === 'motorcycle' && (
        // The codes are the same standard; getting at them is not. Euro 4
        // (2016+) brought OBD to EU bikes, Euro 5 standardised the red 6-pin
        // ISO 19689 socket — neither is the car's 16-pin OBD-II plug, and many
        // scooters have no socket at all.
        <p className="faint text-sm">
          {t('diag.bikeConnector')}
        </p>
      )}

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="P0420"
        aria-label={t('diag.a11yObdCode')}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={`input ${unrecognised ? 'input-error' : ''}`}
      />

      {unrecognised && (
        <span role="alert" className="error-text">
          {t('diag.notObdCode')}
        </span>
      )}

      {result && (
        <div className="card flex flex-col gap-1 p-3">
          <div className="font-medium">{describeLookup(result)}</div>
          <div className="muted text-sm">{result.systemLabel}</div>
          {!result.generic && (
            <div className="faint text-sm">
              {t('diag.manufacturerCode', { char: result.code[1] ?? '' })}
            </div>
          )}
          {result.generic && !result.description && result.subsystem && (
            <div className="faint text-sm">
              {t('diag.standardNotListed')}
            </div>
          )}
          {onAsk && (
            <button
              type="button"
              onClick={() =>
                onAsk(
                  `My reader shows ${result.code}${
                    result.description ? ` (${result.description})` : ''
                  }. What should I check, and how urgent is it?`,
                )
              }
              className="link-accent mt-1 self-start"
            >
              {t('diag.askWhatToDo')}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
