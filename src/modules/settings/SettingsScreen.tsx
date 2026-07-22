import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getSetting, removeSetting, setSetting, SETTING_KEYS } from '../../db/settings'
import { daysSince, exportData, importData, parseBackup } from '../../db/backup'
import { DEFAULT_MODEL, MODEL_OPTIONS } from '../../ai/aiClient'
import { describeSize } from '../logbook/imageProcessing'
import { checkForUpdate, RELEASES_PAGE, type UpdateInfo } from './updateCheck'

export function SettingsScreen() {
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
  const [dataMessage, setDataMessage] = useState<string | null>(null)
  const [includePhotos, setIncludePhotos] = useState(true)
  const importInput = useRef<HTMLInputElement>(null)

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
      <section className="flex flex-col gap-3">
        <h2 className="section-title">AI provider</h2>
        <p className="muted text-sm">
          AI features call Anthropic directly from this device using your own API key. The key
          is stored only in this browser and sent nowhere else. Everything except AI works
          without a key.
        </p>

        <label className="flex flex-col gap-1">
          <span className="label">API key</span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder={stored.apiKey ? '••••••••  (key is saved)' : 'sk-ant-...'}
            autoComplete="off"
            className="input"
          />
          {stored.apiKey ? (
            <span className="text-sm text-green-700 dark:text-green-400">
              Key saved (ends …{stored.apiKey.slice(-4)})
            </span>
          ) : (
            <span className="text-sm text-amber-700 dark:text-amber-400">
              No key yet — AI features are off
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="label">Model</span>
          <select
            value={MODEL_OPTIONS.some((o) => o.value === model) ? model : 'custom'}
            onChange={(e) => setModelInput(e.target.value === 'custom' ? '' : e.target.value)}
            className="input"
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
            <option value="custom">Custom model id…</option>
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
            Auto uses Haiku for receipt reading and Sonnet for the assistant.
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
            <span className="font-medium">Allow live web search in the assistant</span>
            <br />
            <span className="muted">
              Real part/price links; costs about 1 cent per search on your key
            </span>
          </span>
        </label>

        <button type="button" onClick={handleSave} className="btn-primary">
          {saved ? 'Saved ✓' : 'Save'}
        </button>

        {stored.apiKey && (
          <button
            type="button"
            onClick={() => removeSetting(SETTING_KEYS.aiApiKey)}
            className="btn-danger"
          >
            Remove API key
          </button>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="section-title">Data</h2>
        <p className="muted text-sm">
          iOS can wipe app storage after long inactivity — export a backup now and then. The
          backup contains your cars, entries and preferences, but never your API key.
        </p>

        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={includePhotos}
            onChange={(e) => setIncludePhotos(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-red-600"
          />
          <span className="text-sm">
            Include photos and documents
            <span className="faint block">
              Keeps the backup complete. Turn off for a much smaller file.
            </span>
          </span>
        </label>

        <button
          type="button"
          onClick={async () => {
            const backup = await exportData(includePhotos)
            const blob = new Blob([JSON.stringify(backup, null, 2)], {
              type: 'application/json',
            })
            const a = document.createElement('a')
            a.href = URL.createObjectURL(blob)
            a.download = `garagebook-backup-${backup.exportedAt.slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(a.href)
            const photos = backup.attachments?.length ?? 0
            setDataMessage(
              `Exported ${backup.cars.length} cars, ${backup.entries.length} entries` +
                `${photos > 0 ? `, ${photos} photo${photos === 1 ? '' : 's'}` : ''}` +
                ` (${describeSize(blob.size)}).`,
            )
          }}
          className="btn-primary"
        >
          Export backup
        </button>

        <input
          ref={importInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            try {
              const backup = parseBackup(await file.text())
              const summary = `${backup.cars.length} cars and ${backup.entries.length} entries from ${backup.exportedAt.slice(0, 10)}`
              if (
                !window.confirm(
                  `Import ${summary}?\n\nThis REPLACES everything currently in the app.`,
                )
              )
                return
              await importData(backup)
              setDataMessage(`Imported ${summary}.`)
            } catch (err) {
              setDataMessage(err instanceof Error ? err.message : 'Import failed.')
            }
          }}
        />
        <button
          type="button"
          onClick={() => importInput.current?.click()}
          className="btn-secondary"
        >
          Import backup…
        </button>

        {dataMessage && <span className="muted text-sm">{dataMessage}</span>}

        <span className="muted text-sm">
          {(() => {
            const days = daysSince(stored.lastBackupAt)
            if (days === null) return 'No backup exported yet.'
            if (days === 0) return 'Last backup: today.'
            return `Last backup: ${days} day${days === 1 ? '' : 's'} ago.`
          })()}
        </span>
      </section>

      {update && (
        <a
          href={update.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-between gap-2 rounded-xl border border-red-300 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-950"
        >
          <span className="min-w-0">
            <span className="font-semibold text-red-900 dark:text-red-200">
              Version {update.version} is available
            </span>
            <span className="muted block text-xs">
              Download it and install over this one — your data is kept.
            </span>
          </span>
          <span className="link-accent shrink-0 font-semibold">Get it</span>
        </a>
      )}

      <p className="muted pb-2 text-center text-xs">
        GarageBook v{__APP_VERSION__}
        {!update && (
          <>
            {' · '}
            <a href={RELEASES_PAGE} target="_blank" rel="noreferrer" className="link-accent">
              Releases
            </a>
          </>
        )}
      </p>
    </div>
  )
}
