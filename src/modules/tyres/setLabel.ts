import type { TyreSet } from '../../db/db'
import type { TranslationKey } from '../../i18n/en'

type T = (key: TranslationKey, vars?: Record<string, string | number>) => string

// The screen version of tyreLogic's setLabel. A named set ("Nokian WR") reads
// the same in any language; only the unnamed fallback ("winter set") needs
// translating. tyreLogic keeps its own English version for the non-React
// callers — service-history export and the assistant context.
export function localSetLabel(set: Pick<TyreSet, 'season' | 'brand' | 'model'>, t: T): string {
  const name = [set.brand, set.model].filter(Boolean).join(' ').trim()
  if (name) return name
  return t('tyres.setFallback', { season: t(`season.${set.season}` as TranslationKey) })
}
