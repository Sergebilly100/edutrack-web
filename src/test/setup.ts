import "@testing-library/jest-dom/vitest"

import { afterAll, afterEach, beforeAll, vi } from "vitest"

import { server } from "@/test/msw/server"

// Mock IndexedDB for offline tests
const indexedDBMock = {
  open: vi.fn(() => ({
    onupgradeneeded: null,
    onsuccess: null,
    onerror: null,
    result: {
      createObjectStore: vi.fn(),
      transaction: vi.fn(() => ({
        objectStore: vi.fn(() => ({
          get: vi.fn(),
          put: vi.fn(),
          delete: vi.fn(),
          clear: vi.fn(),
        })),
      })),
    },
  })),
  deleteDatabase: vi.fn(),
}

global.indexedDB = indexedDBMock as unknown as IDBFactory

beforeAll(() => {
  server.listen({ onUnhandledRequest: "bypass" })
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
