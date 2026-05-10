/**
 * IndexedDB helper pour cache offline des entités métier
 * Utilisé principalement pour QR scan offline (rooms)
 */

const DB_NAME = 'edutrack_offline'
const DB_VERSION = 1

type RoomCacheEntry = {
  id: string
  name: string
  qr_token: string
  cached_at: number // timestamp
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (!db.objectStoreNames.contains('rooms')) {
        const roomsStore = db.createObjectStore('rooms', { keyPath: 'id' })
        roomsStore.createIndex('qr_token', 'qr_token', { unique: true })
      }
    }
  })
}

export const cacheRooms = async (rooms: RoomCacheEntry[]): Promise<void> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readwrite')
  const store = tx.objectStore('rooms')

  const now = Date.now()
  for (const room of rooms) {
    await store.put({ ...room, cached_at: now })
  }

  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })

  db.close()
}

export const getRoomByToken = async (qrToken: string): Promise<RoomCacheEntry | null> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readonly')
  const store = tx.objectStore('rooms')
  const index = store.index('qr_token')

  return new Promise((resolve, reject) => {
    const request = index.get(qrToken)

    request.onsuccess = () => {
      const result = request.result as RoomCacheEntry | undefined
      resolve(result ?? null)
    }

    request.onerror = () => reject(request.error)
  })
}

export const getAllCachedRooms = async (): Promise<RoomCacheEntry[]> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readonly')
  const store = tx.objectStore('rooms')

  return new Promise((resolve, reject) => {
    const request = store.getAll()

    request.onsuccess = () => {
      resolve((request.result as RoomCacheEntry[]) ?? [])
    }

    request.onerror = () => reject(request.error)
  })
}

export const clearRoomsCache = async (): Promise<void> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readwrite')
  const store = tx.objectStore('rooms')

  await new Promise<void>((resolve, reject) => {
    const request = store.clear()

    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}
