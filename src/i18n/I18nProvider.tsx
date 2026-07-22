import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSetting, setSetting, SETTING_KEYS } from '../db/settings'
import { en, type TranslationKey } from './en'
import { sk } from './sk'
import { detectLanguage, isLanguage, LOCALES, type Language } from './languages'
import { pluralise, type PluralForms } from './plural'

const DICTS = { en, sk } as const

interface I18nValue {
  language: Language
  locale: string
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
  plural: (count: number, forms: PluralForms) => string
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  // Start from the device, then adopt the stored choice once it loads. Doing it
  // this way means the very first paint is already in the right language for a
  // Slovak phone rather than flashing English.
  const [language, setLanguageState] = useState<Language>(detectLanguage)

  useEffect(() => {
    void getSetting(SETTING_KEYS.language).then((stored) => {
      if (isLanguage(stored)) setLanguageState(stored)
    })
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
    void setSetting(SETTING_KEYS.language, lang)
  }, [])

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[language]
    const locale = LOCALES[language]
    return {
      language,
      locale,
      setLanguage,
      t: (key, vars) => {
        // English is the fallback for anything a translation forgot at runtime;
        // the build already prevents a missing key.
        let text = dict[key] ?? en[key] ?? key
        if (vars) {
          for (const [name, v] of Object.entries(vars)) {
            text = text.replaceAll(`{${name}}`, String(v))
          }
        }
        return text
      },
      plural: (count, forms) => pluralise(count, locale, forms),
    }
  }, [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>')
  return ctx
}

/** Shorthand for the common case: const t = useT() */
export function useT(): I18nValue['t'] {
  return useI18n().t
}
