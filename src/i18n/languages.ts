import { regionFromLocale } from '../ai/region'

export const LANGUAGES = ['en', 'sk'] as const
export type Language = (typeof LANGUAGES)[number]

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  sk: 'Slovenčina',
}

// BCP-47 tags for Intl (plurals, dates, numbers) — not the same as the UI key.
export const LOCALES: Record<Language, string> = {
  en: 'en-GB',
  sk: 'sk-SK',
}

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value)
}

// Pick a starting language from the device: Slovak phones get Slovak, everyone
// else gets English. The owner can always override it in Settings.
export function detectLanguage(): Language {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const tag of candidates) {
    const lang = tag.split(/[-_]/)[0]?.toLowerCase()
    if (isLanguage(lang)) return lang
    // A Slovak region with another UI language still suggests Slovak.
    if (regionFromLocale(tag)?.code === 'SK') return 'sk'
  }
  return 'en'
}
