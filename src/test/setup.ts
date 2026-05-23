import "@testing-library/jest-dom/vitest"

import { afterAll, afterEach, beforeAll, vi } from "vitest"

import { server } from "@/test/msw/server"

vi.mock("@/shared/hooks/useStudentLabel", () => {
  const defaultLabels = {
    singular: "Élève",
    plural: "Élèves",
    singularLower: "élève",
    pluralLower: "élèves",
  }
  return {
    useStudentLabel: () => defaultLabels.singular,
    useStudentLabels: () => defaultLabels,
  }
})

const roomsStore = new Map<string, { id: string; qr_token?: string } & Record<string, unknown>>()

const createRequest = <T,>(resultFactory: () => T): IDBRequest<T> => {
  const request = {
    onsuccess: null,
    onerror: null,
    result: undefined as T,
    error: null,
  } as unknown as IDBRequest<T>

  window.setTimeout(() => {
    Object.assign(request, { result: resultFactory() })
    request.onsuccess?.({ target: request } as unknown as Event)
  }, 0)

  return request
}

const createObjectStore = (tx?: { complete: () => void }) => ({
  createIndex: vi.fn(),
  index: vi.fn(() => ({
    get: vi.fn((qrToken: string) =>
      createRequest(() => {
        for (const room of roomsStore.values()) {
          if (room.qr_token === qrToken) return room
        }
        return undefined
      })
    ),
  })),
  get: vi.fn((id: string) => createRequest(() => roomsStore.get(id))),
  getAll: vi.fn(() => createRequest(() => Array.from(roomsStore.values()))),
  put: vi.fn((value: { id: string; qr_token?: string } & Record<string, unknown>) =>
    createRequest(() => {
      roomsStore.set(value.id, value)
      tx?.complete()
      return value.id
    })
  ),
  delete: vi.fn((id: string) =>
    createRequest(() => {
      roomsStore.delete(id)
      tx?.complete()
      return undefined
    })
  ),
  clear: vi.fn(() =>
    createRequest(() => {
      roomsStore.clear()
      tx?.complete()
      return undefined
    })
  ),
})

// Mock IndexedDB for offline tests
const indexedDBMock = {
  open: vi.fn(() => {
    const db = {
      objectStoreNames: { contains: vi.fn(() => roomsStore.size > 0) },
      createObjectStore: vi.fn(() => createObjectStore()),
      transaction: vi.fn(() => {
        const tx = {
          oncomplete: null as ((event: Event) => void) | null,
          onerror: null,
          onabort: null,
          error: null,
          objectStore: vi.fn(() =>
            createObjectStore({
              complete: () => {
                window.setTimeout(() => tx.oncomplete?.({} as Event), 0)
              },
            })
          ),
        }
        return tx
      }),
      close: vi.fn(),
    }
    const request = {
      onupgradeneeded: null as ((event: Event) => void) | null,
      onsuccess: null as ((event: Event) => void) | null,
      onerror: null,
      result: db,
      error: null,
    }
    window.setTimeout(() => {
      request.onupgradeneeded?.({ target: request } as unknown as Event)
      request.onsuccess?.({ target: request } as unknown as Event)
    }, 0)
    return request
  }),
  deleteDatabase: vi.fn(() => {
    roomsStore.clear()
    return createRequest(() => undefined)
  }),
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
