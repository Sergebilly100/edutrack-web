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

const waitForRequest = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })

const waitForTransaction = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })

export const cacheRooms = async (rooms: RoomCacheEntry[]): Promise<void> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readwrite')
  const store = tx.objectStore('rooms')
  const txDone = waitForTransaction(tx)

  const now = Date.now()
  const requests = rooms.map((room) => store.put({ ...room, cached_at: now }))
  await Promise.all(requests.map(waitForRequest))

  await txDone
  db.close()
}

export const getRoomByToken = async (qrToken: string): Promise<RoomCacheEntry | null> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readonly')
  const store = tx.objectStore('rooms')
  const index = store.index('qr_token')

  const result = await waitForRequest(index.get(qrToken))
  db.close()
  return (result as RoomCacheEntry | undefined) ?? null
}

export const getAllCachedRooms = async (): Promise<RoomCacheEntry[]> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readonly')
  const store = tx.objectStore('rooms')

  const result = await waitForRequest(store.getAll())
  db.close()
  return (result as RoomCacheEntry[]) ?? []
}

export const clearRoomsCache = async (): Promise<void> => {
  const db = await openDB()
  const tx = db.transaction('rooms', 'readwrite')
  const store = tx.objectStore('rooms')
  const txDone = waitForTransaction(tx)

  await waitForRequest(store.clear())
  await txDone

  db.close()
}
