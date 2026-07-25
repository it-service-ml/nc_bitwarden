/**
 */

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

export const DEFAULT_ATTACHMENT_MAX_MB = 25

const endpoint = () =>
  generateUrl(
    '/apps/nc_bitwarden/attachment-settings',
  )

let cachedSettings = null
let loadingPromise = null

function normalizeSettings(value = {}) {
  const maxMb = Math.max(
    1,
    Math.min(
      1024,
      Number(value.maxMb)
        || DEFAULT_ATTACHMENT_MAX_MB,
    ),
  )

  return {
    maxMb,
    maxBytes:
      Number(value.maxBytes)
      || maxMb * 1024 * 1024,
  }
}

export async function loadAttachmentLimit(
  force = false,
) {
  if (!force && cachedSettings) {
    return cachedSettings
  }

  if (!force && loadingPromise) {
    return loadingPromise
  }

  loadingPromise = axios
    .get(endpoint())
    .then(response => {
      cachedSettings = normalizeSettings(
        response.data,
      )

      return cachedSettings
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export async function saveAttachmentLimit(maxMb) {
  const normalized = Math.max(
    1,
    Math.min(1024, Number(maxMb) || 25),
  )

  const response = await axios.post(
    endpoint(),
    { maxMb: normalized },
  )

  cachedSettings = normalizeSettings(
    response.data,
  )

  return cachedSettings
}
