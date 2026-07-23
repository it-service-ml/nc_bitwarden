<template>
  <NcDialog
    :name="folder ? 'Ordner umbenennen' : 'Neuer persönlicher Ordner'"
    size="small"
    @close="$emit('close')"
  >
    <div class="bw-folder-dialog">
      <NcTextField
        v-model="name"
        label="Ordnername"
        :disabled="saving"
        @keyup.enter="save"
      />

      <p v-if="error" class="bw-folder-dialog__error">
        {{ error }}
      </p>
    </div>

    <template #actions>
      <NcButton
        :disabled="saving"
        @click="$emit('close')"
      >
        Abbrechen
      </NcButton>

      <NcButton
        type="primary"
        :disabled="saving || !name.trim()"
        @click="save"
      >
        {{ saving ? 'Speichern …' : 'Speichern' }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import { ref } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { BitwardenApi } from '../services/api.js'
import {
  decryptEncString,
  encryptString,
} from '../services/crypto.js'

const props = defineProps({
  folder: {
    type: Object,
    default: null,
  },
  userKey: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'saved'])

const name = ref(props.folder?.name ?? '')
const saving = ref(false)
const error = ref('')

function responseValue(response, pascalName, camelName) {
  return response?.[pascalName] ?? response?.[camelName] ?? null
}

async function save() {
  const trimmedName = name.value.trim()

  if (!trimmedName || saving.value) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const encryptedName = await encryptString(
      trimmedName,
      props.userKey.encKey,
      props.userKey.macKey,
    )

    const payload = {
      name: encryptedName,
    }

    const raw = props.folder
      ? await BitwardenApi.updateFolder(props.folder.id, payload)
      : await BitwardenApi.createFolder(payload)

    const id = responseValue(raw, 'Id', 'id')
    const returnedName = responseValue(raw, 'Name', 'name')

    if (!id || !returnedName) {
      throw new Error('Vaultwarden hat keinen vollständigen Ordner zurückgegeben.')
    }

    const decryptedName = await decryptEncString(
      returnedName,
      props.userKey.encKey,
      props.userKey.macKey,
    )

    emit('saved', {
      id,
      name: decryptedName,
    })
  } catch (exception) {
    console.error('[nc_bitwarden] Ordner konnte nicht gespeichert werden:', exception)
    error.value = exception?.response?.data?.error
      || exception?.message
      || 'Der Ordner konnte nicht gespeichert werden.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-folder-dialog {
  min-width: 320px;
  padding: 1rem;
}

.bw-folder-dialog__error {
  margin: 0.75rem 0 0;
  color: var(--color-error);
}
</style>
