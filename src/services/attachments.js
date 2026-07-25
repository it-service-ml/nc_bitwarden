/**
 *
 * Browserseitige Bitwarden-Anhangsverschlüsselung.
 * Unverschlüsselte Dateiinhalte verlassen den Browser nicht.
 */

import { VaultwardenApi } from './api.js'
import {
  decryptFileData,
  encryptFileData,
  encryptString,
  encryptSymmetricKey,
  generateUserSymmetricKey,
} from './crypto.js'

function responseValue(response, ...keys) {
  for (const key of keys) {
    if (
      response
      && response[key] !== undefined
      && response[key] !== null
    ) {
      return response[key]
    }
  }

  return null
}

function errorMessage(exception, fallback) {
  return (
    exception?.response?.data?.error
    || exception?.response?.data?.message
    || exception?.message
    || fallback
  )
}

async function createAndUploadAttachment(
  cipherId,
  fileName,
  encryptedData,
  attachmentKey,
  wrappingKey,
) {
  const encryptedKey = await encryptSymmetricKey(
    attachmentKey,
    wrappingKey,
  )

  /*
   * Bitwarden verschlüsselt den Dateinamen mit dem Schlüssel,
   * der auch die übrigen Cipher-Felder schützt. Der Dateikörper
   * wird dagegen mit dem separaten Anhangsschlüssel verschlüsselt.
   */
  const encryptedFileName = await encryptString(
    fileName,
    wrappingKey.encKey,
    wrappingKey.macKey,
  )

  const initialized = await VaultwardenApi.createAttachment(
    cipherId,
    {
      key: encryptedKey,
      fileName: encryptedFileName,
      fileSize: encryptedData.byteLength,
    },
  )

  const attachmentId = responseValue(
    initialized,
    'attachmentId',
    'AttachmentId',
    'id',
    'Id',
  )

  const uploadType = Number(
    responseValue(
      initialized,
      'fileUploadType',
      'FileUploadType',
    ) ?? 0,
  )

  if (!attachmentId) {
    throw new Error(
      'Vaultwarden hat keine Anhangs-ID zurückgegeben.',
    )
  }

  if (uploadType !== 0) {
    try {
      await VaultwardenApi.deleteAttachment(
        cipherId,
        attachmentId,
      )
    } catch {
      // Bestmögliche Bereinigung.
    }

    throw new Error(
      'Der Server verlangt einen nicht unterstützten '
        + 'externen Upload-Typ.',
    )
  }

  try {
    await VaultwardenApi.uploadAttachment(
      cipherId,
      attachmentId,
      encryptedData,
      encryptedFileName,
    )
  } catch (exception) {
    try {
      await VaultwardenApi.deleteAttachment(
        cipherId,
        attachmentId,
      )
    } catch (cleanupException) {
      console.error(
        '[nc_bitwarden] Unvollständiger Anhang '
          + 'konnte nicht entfernt werden:',
        cleanupException,
      )
    }

    throw new Error(
      errorMessage(
        exception,
        'Die verschlüsselte Datei konnte nicht '
          + 'hochgeladen werden.',
      ),
    )
  }

  return {
    id: attachmentId,
    fileName,
    encryptedFileName,
    encryptedKey,
    key: attachmentKey,
    size: encryptedData.byteLength,
    sizeName: '',
    unavailable: false,
  }
}

export async function uploadCipherAttachment(
  cipherId,
  file,
  wrappingKey,
) {
  if (!cipherId) {
    throw new Error(
      'Der Eintrag besitzt noch keine ID.',
    )
  }

  if (!file) {
    throw new Error(
      'Es wurde keine Datei ausgewählt.',
    )
  }

  if (!wrappingKey?.encKey || !wrappingKey?.macKey) {
    throw new Error(
      'Der Verschlüsselungsschlüssel des Eintrags fehlt.',
    )
  }

  const attachmentKey = generateUserSymmetricKey()
  const plaintext = await file.arrayBuffer()
  const encryptedData = await encryptFileData(
    plaintext,
    attachmentKey,
  )

  return createAndUploadAttachment(
    cipherId,
    file.name || 'Anhang',
    encryptedData,
    attachmentKey,
    wrappingKey,
  )
}

export async function downloadCipherAttachment(
  cipherId,
  attachment,
) {
  if (!attachment?.key) {
    throw new Error(
      'Der Anhangsschlüssel ist nicht verfügbar.',
    )
  }

  const encryptedData =
    await VaultwardenApi.downloadAttachment(
      cipherId,
      attachment.id,
    )

  return decryptFileData(
    encryptedData,
    attachment.key,
  )
}

/**
 * Kopiert Anhänge bei einem Besitzerwechsel.
 *
 * Der verschlüsselte Dateikörper bleibt unverändert. Nur der
 * Anhangsschlüssel und der Dateiname werden für das Ziel neu
 * verschlüsselt. Das Original wird erst nach vollständigem Erfolg
 * durch ItemForm gelöscht.
 */
export async function copyCipherAttachments(
  sourceItem,
  targetCipherId,
  targetWrappingKey,
) {
  const attachments = sourceItem?.attachments ?? []

  for (const attachment of attachments) {
    if (!attachment?.id || !attachment?.key) {
      throw new Error(
        `Anhang „${attachment?.fileName || 'Unbekannt'}“ `
          + 'kann nicht sicher übertragen werden.',
      )
    }

    const encryptedData =
      await VaultwardenApi.downloadAttachment(
        sourceItem.id,
        attachment.id,
      )

    await createAndUploadAttachment(
      targetCipherId,
      attachment.fileName || 'Anhang',
      encryptedData,
      attachment.key,
      targetWrappingKey,
    )
  }
}
