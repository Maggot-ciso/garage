import { CircleDot, FileText, Fuel, Hammer, Package, Wrench, type LucideIcon } from 'lucide-react'
import type { EntryCategory } from '../db/db'

export const CATEGORY_LABELS: Record<EntryCategory, string> = {
  fuel: 'Fuel',
  service: 'Service',
  repair: 'Repair',
  tyres: 'Tyres',
  insurance: 'Insurance',
  other: 'Other',
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
  const Icon = CATEGORY_ICONS[category]
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <Icon className="h-4 w-4 shrink-0 opacity-60" strokeWidth={2} aria-hidden />
      {CATEGORY_LABELS[category]}
    </span>
  )
}
