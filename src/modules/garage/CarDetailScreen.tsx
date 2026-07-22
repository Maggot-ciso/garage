import { useState } from 'react'
import { useT } from '../../i18n/I18nProvider'
import { ArrowLeft, ArrowUp, Bell, ChevronRight, Pencil, Share2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Car } from '../../db/db'
import { entriesForCar } from '../../db/entries'
import { getSetting, SETTING_KEYS } from '../../db/settings'
import { averageEconomy, fuelEconomySeries, totalCost } from '../insights/calculations'
import { CategoryTag } from '../../components/categoryIcons'
import type { TabId } from '../../components/TabBar'
import { RemindersPanel } from '../reminders/RemindersPanel'
import { TyresPanel } from '../tyres/TyresPanel'
import { useCarChat } from '../assistant/useCarChat'
import { shareServiceHistory } from './shareHistory'
import { VehicleDocumentsPanel } from './VehicleDocumentsPanel'

const RECENT = 4

export function CarDetailScreen({
  car,
  onBack,
  onEdit,
  onOpenTab,
}: {
  car: Car
  onBack: () => void
  onEdit: () => void
  onOpenTab: (tab: TabId) => void
}) {
  const [showReminders, setShowReminders] = useState(false)
  const t = useT()
  const [shareNote, setShareNote] = useState<string | null>(null)
  const entries = useLiveQuery(() => entriesForCar(car.id), [car.id])

  if (entries === undefined) return null

  const avg = averageEconomy(fuelEconomySeries(entries))
  const odometer = entries.reduce((max, e) => Math.max(max, e.odometer), car.odometer)

  return (
    <div className="flex flex-col gap-4 pb-2">
      <button type="button" onClick={onBack} className="link-accent flex items-center gap-1 self-start">
        <ArrowLeft className="h-4 w-4" strokeWidth={2} aria-hidden /> Garage
      </button>

      <div className="card flex items-center gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold tracking-tight">
            {car.make} {car.model}
          </div>
          <div className="muted mt-0.5 text-sm">
            {car.year}
            {car.engine ? ` · ${car.engine}` : ''} · {odometer.toLocaleString()} km
          </div>
        </div>
        <button
          type="button"
          aria-label={t('detail.a11yReminders')}
          onClick={() => setShowReminders((s) => !s)}
          className={`rounded-xl border p-2.5 ${
            showReminders
              ? 'border-red-600 bg-red-50 text-red-700 dark:border-red-500 dark:bg-red-950 dark:text-red-300'
              : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
          }`}
        >
          <Bell className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label={t('detail.a11yShare')}
          onClick={async () => {
            setShareNote(null)
            const outcome = await shareServiceHistory(
              car,
              entries,
              new Date().toISOString().slice(0, 10),
            )
            setShareNote(
              outcome === 'copied'
                ? t('detail.shareCopied')
                : outcome === 'failed'
                  ? t('detail.shareFailed')
                  : null,
            )
          }}
          className="rounded-xl border border-slate-300 p-2.5 text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <Share2 className="h-5 w-5" strokeWidth={1.8} />
        </button>
        <button
          type="button"
          aria-label={t('detail.a11yEdit', { name: `${car.make} ${car.model}` })}
          onClick={onEdit}
          className="rounded-xl border border-slate-300 p-2.5 text-slate-500 dark:border-slate-700 dark:text-slate-400"
        >
          <Pencil className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {shareNote && <p className="faint text-sm">{shareNote}</p>}

      {showReminders && <RemindersPanel carId={car.id} />}

      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => onOpenTab('insights')} className="card-tap p-3">
          <div className="muted text-sm">{t('insights.avgEconomy')}</div>
          <div className="text-lg font-bold tracking-tight">
            {avg !== null ? `${avg} L/100km` : '—'}
          </div>
        </button>
        <button type="button" onClick={() => onOpenTab('insights')} className="card-tap p-3">
          <div className="muted text-sm">{t('insights.totalSpent')}</div>
          <div className="text-lg font-bold tracking-tight">
            {totalCost(entries).toFixed(2)} €
          </div>
        </button>
      </div>

      <TyresPanel carId={car.id} odometer={odometer} />

      <VehicleDocumentsPanel carId={car.id} />

      <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title">{t('detail.recentEntries')}</h2>
          <button
            type="button"
            onClick={() => onOpenTab('logbook')}
            className="link-accent flex items-center"
          >
            {t('detail.logbookLink')} <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="faint text-sm">{t('detail.nothingLogged')}</p>
        ) : (
          <ul className="card divide-y divide-slate-100 dark:divide-slate-800">
            {entries.slice(0, RECENT).map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
                <CategoryTag category={entry.category} className="min-w-0 truncate" />
                <span className="muted shrink-0">{entry.date}</span>
                <span className="w-20 shrink-0 text-right font-medium">
                  {entry.cost.toFixed(2)} €
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <CarMiniChat car={car} onOpenTab={onOpenTab} />
    </div>
  )
}

function CarMiniChat({ car, onOpenTab }: { car: Car; onOpenTab: (tab: TabId) => void }) {
  const [input, setInput] = useState('')
  const t = useT()
  const apiKey = useLiveQuery(async () => (await getSetting(SETTING_KEYS.aiApiKey)) ?? null, [])
  const { messages, busy, error, pending, send, resolvePending } = useCarChat(car)

  if (apiKey === undefined || messages === undefined) return null

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="section-title">{t('detail.askAi')}</h2>
        <button
          type="button"
          onClick={() => onOpenTab('assistant')}
          className="link-accent flex items-center"
        >
          {t('detail.fullChat')} <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden />
        </button>
      </div>

      {!apiKey ? (
        <p className="faint text-sm">{t('detail.needKey')}</p>
      ) : (
        <div className="card flex flex-col gap-2 p-3">
          {messages.length === 0 && !busy && (
            <p className="faint text-sm">
              {t('detail.chatHint', { model: car.model })}
            </p>
          )}
          {messages.length > 0 && (
            <div className="flex max-h-56 flex-col gap-2 overflow-y-auto">
              {messages.slice(-4).map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[90%] whitespace-pre-wrap rounded-xl px-2.5 py-1.5 text-sm leading-relaxed ${
                    m.role === 'user'
                      ? 'self-end bg-red-600 text-white'
                      : 'self-start bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {m.text}
                </div>
              ))}
            </div>
          )}

          {busy && !pending && <p className="faint text-sm">{t('chat.thinking')}</p>}

          {pending && (
            <div className="flex flex-col gap-2 rounded-xl border border-red-300 bg-red-50 p-2.5 text-sm dark:border-red-800 dark:bg-red-950">
              <span className="font-medium text-red-900 dark:text-red-200">
                {pending.description}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resolvePending(true)}
                  className="flex-1 rounded-lg py-1.5 font-semibold bg-slate-900 text-white active:bg-slate-800 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200"
                >
                  ✓ Confirm
                </button>
                <button
                  type="button"
                  onClick={() => resolvePending(false)}
                  className="flex-1 rounded-lg border border-slate-300 bg-white py-1.5 font-medium text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                >
                  ✗ No
                </button>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="notice-error">
              {error}
            </p>
          )}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('detail.chatPlaceholder', { model: car.model })}
              rows={1}
              className="input min-w-0 flex-1 resize-none py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                const text = input
                setInput('')
                void send(text)
              }}
              disabled={busy || !input.trim()}
              aria-label={t('chat.a11ySend')}
              className="shrink-0 rounded-xl px-3 py-2 bg-slate-900 text-white active:bg-slate-800 dark:bg-white dark:text-slate-900 dark:active:bg-slate-200 disabled:opacity-50"
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.2} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
