import type { TranslationKey } from './en'

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// Form validation returns keys rather than sentences, so a Slovak user never
// meets an English message in a Slovak form. Most messages are a bare key; a
// few need a number filled in, and those carry their vars along.
export type FieldError = TranslationKey | { key: TranslationKey; vars: Record<string, string | number> }

export function errorText(t: T, error: FieldError | undefined): string | undefined {
  if (error === undefined) return undefined
  return typeof error === 'string' ? t(error) : t(error.key, error.vars)
}
