import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Vitest globals are off, so React Testing Library can't self-register
// its auto-cleanup — without this, renders leak across tests.
afterEach(cleanup)
