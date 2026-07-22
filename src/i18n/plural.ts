// Slovak has three plural forms where English has two:
//   1 deň · 2 dni · 5 dní   vs   1 day · 2 days · 5 days
// Intl.PluralRules knows every language's rules, so we never hand-maintain them.
export type PluralForm = 'one' | 'few' | 'many' | 'other'

export interface PluralForms {
  one: string
  few?: string
  many?: string
  other: string
}

export function pluralise(count: number, locale: string, forms: PluralForms): string {
  let form: PluralForm = 'other'
  try {
    form = new Intl.PluralRules(locale).select(count) as PluralForm
  } catch {
    form = count === 1 ? 'one' : 'other'
  }
  // Fall back down the chain when a language does not use a form.
  const text = forms[form] ?? forms.other
  return text.replace('{count}', String(count))
}
