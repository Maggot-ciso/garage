import { useState } from 'react'
import { filterOptions } from '../data/carModels'

// Text input with a tap-to-pick suggestion list. Free text is always
// allowed — the options are a convenience, not a constraint.
export function Combobox({
  value,
  onChange,
  options,
  placeholder,
  hasError,
}: {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  hasError?: boolean
}) {
  const [open, setOpen] = useState(false)
  const filtered = open ? filterOptions(options, value).slice(0, 8) : []
  const exactOnly = filtered.length === 1 && filtered[0] === value

  return (
    <div className="relative">
      <input
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`input ${hasError ? 'input-error' : ''}`}
      />
      {filtered.length > 0 && !exactOnly && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
          {filtered.map((option) => (
            <li key={option}>
              <button
                type="button"
                // pointerdown fires before the input's blur, so the tap
                // registers before the list unmounts (matters on iOS)
                onPointerDown={(e) => {
                  e.preventDefault()
                  onChange(option)
                  setOpen(false)
                }}
                className="w-full border-b border-slate-100 px-3 py-2.5 text-left text-base last:border-b-0 active:bg-red-50 dark:border-slate-800 dark:active:bg-slate-800"
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
