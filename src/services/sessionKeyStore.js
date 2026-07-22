import { b64ToBuffer, bufferToB64 } from './crypto.js'

const STORAGE_KEY = 'nc_bitwarden.session-key.v1'

function getStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function getCurrentUserId() {
  if (typeof document === 'undefined') {
    return null
  }

  return document.head?.getAttribute('data-user') ?? null
}

export function saveSessionKey(userKey) {
  const storage = getStorage()
  const userId = getCurrentUserId()

  if (
    !storage
    || !userId
    || !(userKey?.encKey instanceof ArrayBuffer)
    || !(userKey?.macKey instanceof ArrayBuffer)
  ) {
    return false
  }

  const payload = {
    version: 1,
    userId,
    encKey: bufferToB64(userKey.encKey),
    macKey: bufferToB64(userKey.macKey),
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return true
  } catch (error) {
    console.warn('[nc_bitwarden] Session-Key konnte nicht gespeichert werden:', error)
    return false
  }
}

export function restoreSessionKey() {
  const storage = getStorage()
  const userId = getCurrentUserId()

  if (!storage || !userId) {
    return null
  }

  try {
    const raw = storage.getItem(STORAGE_KEY)

    if (!raw) {
      return null
    }

    const payload = JSON.parse(raw)

    if (
      payload?.version !== 1
      || payload.userId !== userId
      || typeof payload.encKey !== 'string'
      || typeof payload.macKey !== 'string'
    ) {
      clearSessionKey()
      return null
    }

    return {
      encKey: b64ToBuffer(payload.encKey),
      macKey: b64ToBuffer(payload.macKey),
    }
  } catch (error) {
    console.warn('[nc_bitwarden] Gespeicherter Session-Key ist ungültig:', error)
    clearSessionKey()
    return null
  }
}

export function clearSessionKey() {
  const storage = getStorage()

  if (storage) {
    storage.removeItem(STORAGE_KEY)
  }
}
