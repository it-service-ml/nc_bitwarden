<template>
  <section class="bw-attachments">
    <div class="bw-attachments__header">
      <div>
        <div class="bw-attachments__title">
          Anhänge
        </div>

        <div class="bw-attachments__subtitle">
          {{
            readOnly
              ? 'Anhänge können heruntergeladen, aber nicht verändert werden.'
              : 'Dateien werden vor dem Upload im Browser verschlüsselt.'
          }}
        </div>
      </div>

      <NcButton
        v-if="!readOnly"
        variant="primary"
        :disabled="uploading || !ownerKey"
        @click="openFilePicker"
      >
        {{
          uploading
            ? 'Wird hochgeladen …'
            : 'Datei hinzufügen'
        }}
      </NcButton>

      <input
        v-if="!readOnly"
        ref="fileInput"
        type="file"
        hidden
        @change="uploadSelectedFile"
      >
    </div>

    <p
      v-if="error"
      class="bw-attachments__error"
    >
      {{ error }}
    </p>

    <div
      v-if="attachments.length"
      class="bw-attachments__list"
    >
      <article
        v-for="attachment in attachments"
        :key="attachment.id"
        class="bw-attachments__item"
      >
        <div class="bw-attachments__file">
          <strong>
            {{ attachment.fileName || 'Unbenannter Anhang' }}
          </strong>

          <span>
            {{
              attachment.sizeName
                || formatFileSize(attachment.size)
            }}
          </span>

          <span
            v-if="attachment.unavailable"
            class="bw-attachments__unavailable"
          >
            Schlüssel nicht verfügbar
          </span>
        </div>

        <div class="bw-attachments__actions">
          <NcButton
            :disabled="
              busyAttachmentId === attachment.id
                || attachment.unavailable
            "
            @click="downloadAttachment(attachment)"
          >
            {{
              busyAttachmentId === attachment.id
                ? 'Bitte warten …'
                : 'Herunterladen'
            }}
          </NcButton>

          <NcButton
            v-if="!readOnly"
            variant="error"
            :disabled="
              busyAttachmentId === attachment.id
            "
            @click="removeAttachment(attachment)"
          >
            Löschen
          </NcButton>
        </div>
      </article>
    </div>

    <p
      v-else
      class="bw-attachments__empty"
    >
      Dieser Eintrag hat noch keine Anhänge.
    </p>
  </section>
</template>

<script setup>
import {
  computed,
  ref,
  watch,
  onMounted,
} from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import {
  DEFAULT_ATTACHMENT_MAX_MB,
  loadAttachmentLimit,
} from '../services/attachmentLimit.js'
import { VaultwardenApi } from '../services/api.js'
import {
  downloadCipherAttachment,
  uploadCipherAttachment,
} from '../services/attachments.js'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  userKey: {
    type: Object,
    required: true,
  },
  organizationKeys: {
    type: Object,
    default: () => ({}),
  },

  // Stufe 2O-2: schreibgeschützte Anhänge
  readOnly: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['changed'])

const fileInput = ref(null)
const uploading = ref(false)
const busyAttachmentId = ref('')
const error = ref('')

const attachmentMaxMb = ref(
  DEFAULT_ATTACHMENT_MAX_MB,
)

const attachmentMaxBytes = computed(() =>
  attachmentMaxMb.value * 1024 * 1024,
)

onMounted(async () => {
  try {
    const settings = await loadAttachmentLimit()
    attachmentMaxMb.value = settings.maxMb
  } catch (exception) {
    console.warn(
      '[nc_bitwarden] Anhangsgrößenlimit '
        + 'konnte nicht geladen werden:',
      exception,
    )
  }
})
const localAttachments = ref([
  ...(props.item?.attachments ?? []),
])

watch(
  () => props.item?.attachments,
  value => {
    localAttachments.value = [
      ...(value ?? []),
    ]
  },
  { deep: true },
)

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

const attachments = computed(() =>
  localAttachments.value,
)

const ownerKey = computed(() => {
  const organizationId = normalizeId(
    props.item?.organizationId,
  )

  if (!organizationId) {
    return props.userKey
  }

  if (props.organizationKeys[props.item.organizationId]) {
    return props.organizationKeys[
      props.item.organizationId
    ]
  }

  const match = Object.entries(
    props.organizationKeys,
  ).find(([id]) =>
    normalizeId(id) === organizationId,
  )

  return match?.[1] ?? null
})

function emitChanged() {
  emit('changed', {
    cipherId: props.item.id,
    attachments: [...localAttachments.value],
  })
}

function openFilePicker() {
  if (props.readOnly) {
    return
  }

  error.value = ''
  fileInput.value?.click()
}

function formatFileSize(value) {
  const bytes = Number(value ?? 0)

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return ''
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unit = 0

  while (
    size >= 1024
    && unit < units.length - 1
  ) {
    size /= 1024
    unit += 1
  }

  return `${
    new Intl.NumberFormat(
      'de-DE',
      {
        maximumFractionDigits: unit === 0 ? 0 : 1,
      },
    ).format(size)
  } ${units[unit]}`
}

function exceptionMessage(exception, fallback) {
  return (
    exception?.response?.data?.error
    || exception?.response?.data?.message
    || exception?.message
    || fallback
  )
}

async function uploadSelectedFile(event) {
  const file = event.target?.files?.[0] ?? null

  if (event.target) {
    event.target.value = ''
  }

  if (props.readOnly) {
    return
  }

  if (!file || uploading.value) {
    return
  }

  if (file.size > attachmentMaxBytes.value) {
    error.value =
      `Der Anhang ist größer als ${
        attachmentMaxMb.value
      } MiB.`
    return
  }

  if (!ownerKey.value) {
    error.value =
      'Der benötigte Verschlüsselungsschlüssel fehlt.'
    return
  }

  uploading.value = true
  error.value = ''

  try {
    const created = await uploadCipherAttachment(
      props.item.id,
      file,
      ownerKey.value,
    )

    localAttachments.value = [
      ...localAttachments.value,
      created,
    ]

    emitChanged()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Anhang konnte nicht '
        + 'hochgeladen werden:',
      exception,
    )

    error.value = exceptionMessage(
      exception,
      'Der Anhang konnte nicht hochgeladen werden.',
    )
  } finally {
    uploading.value = false
  }
}

async function downloadAttachment(attachment) {
  if (busyAttachmentId.value) {
    return
  }

  busyAttachmentId.value = attachment.id
  error.value = ''

  try {
    const plaintext = await downloadCipherAttachment(
      props.item.id,
      attachment,
    )

    const blob = new Blob(
      [plaintext],
      { type: 'application/octet-stream' },
    )

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download =
      attachment.fileName || 'Anhang'
    link.style.display = 'none'

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(
      () => URL.revokeObjectURL(url),
      1000,
    )
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Anhang konnte nicht '
        + 'heruntergeladen werden:',
      exception,
    )

    error.value = exceptionMessage(
      exception,
      'Der Anhang konnte nicht heruntergeladen werden.',
    )
  } finally {
    busyAttachmentId.value = ''
  }
}

async function removeAttachment(attachment) {
  if (props.readOnly) {
    return
  }

  if (busyAttachmentId.value) {
    return
  }

  const confirmed = window.confirm(
    `Anhang „${
      attachment.fileName || 'Unbenannt'
    }“ endgültig löschen?`,
  )

  if (!confirmed) {
    return
  }

  busyAttachmentId.value = attachment.id
  error.value = ''

  try {
    await VaultwardenApi.deleteAttachment(
      props.item.id,
      attachment.id,
    )

    localAttachments.value =
      localAttachments.value.filter(candidate =>
        candidate.id !== attachment.id,
      )

    emitChanged()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Anhang konnte nicht '
        + 'gelöscht werden:',
      exception,
    )

    error.value = exceptionMessage(
      exception,
      'Der Anhang konnte nicht gelöscht werden.',
    )
  } finally {
    busyAttachmentId.value = ''
  }
}
</script>

<style scoped>

.bw-attachments {
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-hover);
}

.bw-attachments__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bw-attachments__title {
  color: var(--color-main-text);
  font-size: 1rem;
  font-weight: 700;
}

.bw-attachments__subtitle {
  margin-top: 0.2rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-attachments__list {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.bw-attachments__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-attachments__file {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.15rem;
}

.bw-attachments__file strong {
  overflow: hidden;
  color: var(--color-main-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-attachments__file span {
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-attachments__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.4rem;
}

.bw-attachments__error {
  margin: 0;
  padding: 0.65rem 0.8rem;
  border-left: 4px solid var(--color-error);
  background:
    color-mix(
      in srgb,
      var(--color-error) 18%,
      var(--color-main-background)
    );
  color: var(--color-main-text);
}

.bw-attachments__unavailable {
  color: var(--color-error) !important;
  font-weight: 600;
}

.bw-attachments__empty {
  margin: 0;
  color: var(--color-text-maxcontrast);
}

@media (max-width: 760px) {
  .bw-attachments__header,
  .bw-attachments__item {
    align-items: stretch;
    flex-direction: column;
  }

  .bw-attachments__actions {
    width: 100%;
    flex-wrap: wrap;
  }
}
</style>
