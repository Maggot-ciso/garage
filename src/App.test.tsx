import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithI18n } from './test/renderWithI18n'
import userEvent from '@testing-library/user-event'
import App from './App'

describe('App shell', () => {
  it('shows the Garage tab by default', () => {
    renderWithI18n(<App />)
    expect(screen.getByRole('heading', { name: 'Garage', level: 1 })).toBeInTheDocument()
  })

  it('switches tabs via the bottom bar', async () => {
    renderWithI18n(<App />)
    await userEvent.click(screen.getByRole('button', { name: /logbook/i }))
    expect(screen.getByRole('heading', { name: 'Logbook', level: 1 })).toBeInTheDocument()
  })

  it('opens and closes settings from the header', async () => {
    renderWithI18n(<App />)
    await userEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(screen.getByRole('heading', { name: 'Settings', level: 1 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close settings' }))
    expect(screen.getByRole('heading', { name: 'Garage', level: 1 })).toBeInTheDocument()
  })
})
