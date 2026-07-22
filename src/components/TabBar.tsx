import { Car, MessageCircle, NotebookPen, TrendingUp, Wrench, type LucideIcon } from 'lucide-react'
import { useT } from '../i18n/I18nProvider'
import type { TranslationKey } from '../i18n/en'

export type TabId = 'garage' | 'logbook' | 'insights' | 'diagnostics' | 'assistant'

const TABS: { id: TabId; labelKey: TranslationKey; icon: LucideIcon }[] = [
  { id: 'garage', labelKey: 'tab.garage', icon: Car },
  { id: 'logbook', labelKey: 'tab.logbook', icon: NotebookPen },
  { id: 'insights', labelKey: 'tab.insights', icon: TrendingUp },
  { id: 'diagnostics', labelKey: 'tab.diagnostics', icon: Wrench },
  { id: 'assistant', labelKey: 'tab.assistant', icon: MessageCircle },
]

export function TabBar({
  active,
  onChange,
  badges = {},
}: {
  active: TabId
  onChange: (tab: TabId) => void
  badges?: Partial<Record<TabId, number>>
}) {
  const t = useT()
  return (
    <nav className="bar border-t pb-[env(safe-area-inset-bottom)]">
      <ul className="flex">
        {TABS.map((tab) => (
          <li key={tab.id} className="flex-1">
            <button
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
              className={`flex w-full flex-col items-center gap-1 py-2 text-[11px] transition-colors ${
                active === tab.id
                  ? 'font-semibold text-red-600 dark:text-red-500'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <span className="relative" aria-hidden>
                <tab.icon
                  className="h-[22px] w-[22px]"
                  strokeWidth={active === tab.id ? 2.2 : 1.8}
                />
                {(badges[tab.id] ?? 0) > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
                    {badges[tab.id]}
                  </span>
                )}
              </span>
              {t(tab.labelKey)}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}
