import { useState } from 'react'
import { ScanLine } from 'lucide-react'
import { describeLookup, lookupObd } from './obdLookup'

// Reading a code is a table lookup, not a language problem — so this works with
// no key, no network and no cost. The assistant is only offered afterwards, for
// the part that actually needs judgement: what to do about it.
export function ObdPanel({ onAsk }: { onAsk?: (prompt: string) => void }) {
  const [code, setCode] = useState('')
  const trimmed = code.trim()
  const result = trimmed ? lookupObd(trimmed) : null
  const unrecognised = trimmed.length >= 5 && result === null

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ScanLine className="muted h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden />
        <h2 className="section-title">OBD code</h2>
      </div>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="P0420"
        aria-label="OBD-II code"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className={`input ${unrecognised ? 'input-error' : ''}`}
      />

      {unrecognised && (
        <span role="alert" className="error-text">
          Not an OBD-II code — they look like P0420, C1234 or U0100.
        </span>
      )}

      {result && (
        <div className="card flex flex-col gap-1 p-3">
          <div className="font-medium">{describeLookup(result)}</div>
          <div className="muted text-sm">{result.systemLabel}</div>
          {!result.generic && (
            <div className="faint text-sm">
              Second character {result.code[1]} means the carmaker defines this one, so no
              standard meaning exists. Your workshop manual or the assistant may know it.
            </div>
          )}
          {result.generic && !result.description && result.subsystem && (
            <div className="faint text-sm">
              A standard code, but not one in the offline list — the subsystem above is
              certain, the exact fault is not.
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
              Ask what to do about it
            </button>
          )}
        </div>
      )}
    </section>
  )
}
