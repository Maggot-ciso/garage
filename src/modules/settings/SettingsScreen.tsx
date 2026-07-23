import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, removeSetting, setSetting, SETTING_KEYS } from '../../db/settings'
import { DEFAULT_MODEL, MODEL_OPTIONS } from '../../ai/aiClient'
import { checkForUpdate, RELEASES_PAGE, type UpdateInfo } from './updateCheck'
import { DataSection } from './DataSection'
import { useI18n } from '../../i18n/I18nProvider'
import { LANGUAGES, LANGUAGE_LABELS } from '../../i18n/languages'

export function SettingsScreen() {
  const { language, setLanguage, t } = useI18n()
  // A sideloaded app has no store to update it, so it asks GitHub once when
  // Settings opens. Silent on failure — offline is not an error worth shouting
  // about, and the current version is still shown either way.
  const [update, setUpdate] = useState<UpdateInfo | null>(null)
  useEffect(() => {
    let live = true
    void checkForUpdate(__APP_VERSION__).then((u) => {
      if (live) setUpdate(u)
    })
    return () => {
      live = false
    }
  }, [])

  const stored = useLiveQuery(
    async () => ({
      apiKey: await getSetting(SETTING_KEYS.aiApiKey),
      model: await getSetting(SETTING_KEYS.aiModel),
      webSearch: (await getSetting(SETTING_KEYS.aiWebSearch)) === 'on',
      lastBackupAt: await getSetting(SETTING_KEYS.lastBackupAt),
    }),
    [],
  )
  const [keyInput, setKeyInput] = useState('')
  const [modelInput, setModelInput] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (stored === undefined) return null

  const model = modelInput ?? stored.model ?? DEFAULT_MODEL

  async function handleSave() {
    const trimmedKey = keyInput.trim()
    if (trimmedKey) {
      await setSetting(SETTING_KEYS.aiApiKey, trimmedKey)
      setKeyInput('')
    }
    await setSetting(SETTING_KEYS.aiModel, model.trim() || DEFAULT_MODEL)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <span className="label">{t('settings.language')}</span>
        <div className="grid grid-cols-2 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              aria-pressed={language === lang}
              className={`rounded-xl border py-2.5 text-sm ${
                language === lang
                  ? 'border-red-500 bg-red-50 font-semibold text-red-700 dark:bg-red-950 dark:text-red-300'
                  : 'border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300'
              }`}
            >
              {LANGUAGE_LABELS[lang]}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">{t('settings.aiProvider')}</h2>
        <p className="muted text-sm">
          {t('settings.aiBlurb')}
        </p>

        <label className="flex flex-col gap-1">
          <span className="label">{t('settings.apiKey')}</span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={stored.apiKey ? t('settings.keyMasked') : 'sk-ant-...'}
            autoComplete="off"
            className="input"
          />
          {stored.apiKey ? (
            <span className="text-sm text-green-700 dark:text-green-400">
              {t('settings.keySaved', { last4: stored.apiKey.slice(-4) })}
            </span>
          ) : (
            <span className="text-sm text-amber-700 dark:text-amber-400">
              {t('settings.noKey')}
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="label">{t('settings.model')}</span>
          <select
            value={MODEL_OPTIONS.some((o) => o.value === model) ? model : 'custom'}
            onChange={(e) => setModelInput(e.target.value === 'custom' ? '' : e.target.value)}
            className="input"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.label)}
              </option>
            ))}
            <option value="custom">{t('settings.customModel')}</option>
          </select>
          {!MODEL_OPTIONS.some((o) => o.value === model) && (
            <input
              value={model}
              onChange={(e) => setModelInput(e.target.value)}
              placeholder="claude-…"
              className="input"
            />
          )}
          <span className="muted text-sm">
            {t('settings.autoHint')}
          </span>
        </label>

        <label className="card flex items-center gap-3 p-3">
          <input
            type="checkbox"
            checked={stored.webSearch}
            onChange={(e) =>
              void setSetting(SETTING_KEYS.aiWebSearch, e.target.checked ? 'on' : 'off')
            }
            className="h-5 w-5 accent-red-600"
          />
          <span className="text-sm">
            <span className="font-medium">{t('settings.webSearch')}</span>
            <br />
            <span className="muted">
              {t('settings.webSearchHint')}
            </span>
          </span>
        </label>

        <button type="button" onClick={handleSave} className="btn-primary">
          {saved ? t('settings.savedTick') : t('action.save')}
        </button>

        {stored.apiKey && (
          <button
            type="button"
            onClick={() => removeSetting(SETTING_KEYS.aiApiKey)}
            className="btn-danger"
          >
            {t('settings.removeKey')}
          </button>
        )}
      </section>

      <DataSection lastBackupAt={stored.lastBackupAt} />

      {update && (
        <a
          href={update.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950"
        >
          <span className="min-w-0">
            <span className="font-semibold text-red-900 dark:text-red-200">
              {t('settings.updateAvailable', { version: update.version })}
            </span>
            <span className="muted block text-xs">
              {t('settings.updateHint')}
            </span>
          </span>
          <span className="link-accent shrink-0 font-semibold">{t('settings.getIt')}</span>
        </a>
      )}

      <p className="muted pb-2 text-center text-xs">
        GarageBook v{__APP_VERSION__}
        {!update && (
          <>
            {' · '}
            <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="link-accent">
              {t('settings.releases')}
            </a>
          </>
        )}
      </p>
    </div>
  )
}
