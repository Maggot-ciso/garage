import { CircleDot, FileText, Fuel, Hammer, Package, Wrench, type LucideIcon } from 'lucide-react'
import type { TranslationKey } from '../i18n/en'
import { useT } from '../i18n/I18nProvider'
import type { EntryCategory } from '../db/db'

// The label lives in the dictionaries; this only maps a category to its key.
// There is no English copy any more — keeping one meant two sources of truth,
// and the stale one is what the logbook list was rendering.
export function categoryKey(category: EntryCategory): TranslationKey {
  return `category.${category}` as TranslationKey
}

export const CATEGORY_ICONS: Record<EntryCategory, LucideIcon> = {
  fuel: Fuel,
  service: Wrench,
  repair: Hammer,
  tyres: CircleDot,
  insurance: FileText,
  other: Package,
}

export function CategoryTag({
  category,
  className = '',
}: {
  category: EntryCategory
  className?: string
}) {
  const t = useT()
  const Icon = CATEGORY_ICONS[category]
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className="h-4 w-4 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
      {t(categoryKey(category))}
    </span>
  )
}
