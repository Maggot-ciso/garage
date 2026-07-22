import { render, type RenderOptions, type RenderResult } from '@testing-library/react'
import { I18nProvider } from '../i18n/I18nProvider'

// Anything that calls useT()/useI18n() needs the provider, which is mounted once
// at the app root in main.tsx. Tests render components in isolation, so they
// wrap through here instead of repeating the provider everywhere.
export function renderWithI18n(ui: React.ReactElement, options?: RenderOptions): RenderResult {
  return render(ui, { wrapper: I18nProvider, ...options })
}
