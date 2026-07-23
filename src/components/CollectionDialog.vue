<template>
  <NcDialog
    :name="collection ? 'Sammlung umbenennen' : 'Neue Sammlung'"
    size="small"
    @close="$emit('close')"
  >
    <div class="bw-collection-dialog">
      <div class="bw-collection-dialog__field">
        <label for="bw-collection-organization">
          Organisation
        </label>

        <select
          id="bw-collection-organization"
          v-model="organizationId"
          :disabled="saving || Boolean(collection)"
        >
          <option
            v-for="organization in availableOrganizations"
            :key="organization.id"
            :value="organization.id"
          >
            {{ organization.name }}
          </option>
        </select>
      </div>

      <div class="bw-collection-dialog__field">
        <label for="bw-collection-parent">
          Unterhalb von
        </label>

        <NcSelect
          v-model="parentPath"
          input-id="bw-collection-parent"
          :options="parentOptions"
          label="label"
          :reduce="option => option.value"
          :clearable="false"
          :searchable="true"
          :disabled="saving"
          placeholder="Sammlung suchen …"
        />
      </div>

      <NcTextField
        v-model="name"
        label="Name der Sammlung"
        :disabled="saving"
        @keyup.enter="save"
      />

      <p class="bw-collection-dialog__preview">
        Vollständiger Pfad:
        <strong>{{ completePath || '–' }}</strong>
      </p>

      <p v-if="error" class="bw-collection-dialog__error">
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
        :disabled="saving || !canSave"
        @click="save"
      >
        {{ saving ? 'Speichern …' : 'Speichern' }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import { BitwardenApi } from '../services/api.js'
import {
  decryptEncString,
  encryptString,
} from '../services/crypto.js'

const props = defineProps({
  collection: {
    type: Object,
    default: null,
  },
  collections: {
    type: Array,
    default: () => [],
  },
  organizations: {
    type: Array,
    default: () => [],
  },
  organizationKeys: {
    type: Object,
    required: true,
  },
})

const emit = defineEmits(['close', 'saved'])

const existingParts = String(props.collection?.name ?? '')
  .split('/')
  .filter(Boolean)

const name = ref(existingParts.pop() ?? '')
const parentPath = ref(existingParts.join('/'))

const initialOrganization = props.collection?.organizationId
  ?? props.organizations.find(org => org.canCreateCollections)?.id
  ?? props.organizations[0]?.id
  ?? ''

const organizationId = ref(initialOrganization)
const saving = ref(false)
const error = ref('')

const availableOrganizations = computed(() => {
  if (props.collection) {
    return props.organizations.filter(org =>
      normalizeId(org.id) === normalizeId(props.collection.organizationId),
    )
  }

  return props.organizations.filter(org => org.canCreateCollections)
})

const availableParents = computed(() => {
  const currentPath = String(props.collection?.name ?? '')

  return props.collections
    .filter(candidate =>
      normalizeId(candidate.organizationId)
        === normalizeId(organizationId.value),
    )
    .filter(candidate =>
      normalizeId(candidate.id)
        !== normalizeId(props.collection?.id),
    )
    .filter(candidate =>
      !currentPath
      || !String(candidate.name).startsWith(`${currentPath}/`),
    )
    .sort((a, b) =>
      String(a.name).localeCompare(String(b.name), 'de', {
        sensitivity: 'base',
        numeric: true,
      }),
    )
})

const parentOptions = computed(() => [
  {
    value: '',
    label: 'Oberste Ebene',
  },
  ...availableParents.value.map(parent => ({
    value: parent.name,
    label: parent.name,
  })),
])

const completePath = computed(() => {
  const cleanName = name.value.trim()
  const cleanParent = parentPath.value.trim().replace(/^\/+|\/+$/g, '')

  if (!cleanName) {
    return ''
  }

  return cleanParent
    ? `${cleanParent}/${cleanName}`
    : cleanName
})

const canSave = computed(() =>
  Boolean(
    organizationId.value
    && completePath.value
    && props.organizationKeys[organizationId.value],
  ),
)

watch(organizationId, () => {
  if (!props.collection) {
    parentPath.value = ''
  }
})

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

function responseValue(response, pascalName, camelName) {
  return response?.[pascalName] ?? response?.[camelName] ?? null
}

async function buildCollectionUpdatePayload(
  collectionId,
  encryptedName,
) {
  const details = await BitwardenApi.getCollectionDetails(
    organizationId.value,
    collectionId,
  )

  return {
    name: encryptedName,
    groups: details?.groups ?? details?.Groups ?? [],
    users: details?.users ?? details?.Users ?? [],
    externalId:
      details?.externalId
      ?? details?.ExternalId
      ?? null,
  }
}

async function save() {
  if (saving.value || !canSave.value) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const orgKey = props.organizationKeys[organizationId.value]

    if (!orgKey) {
      throw new Error(
        'Der Organisationsschlüssel ist nicht verfügbar.',
      )
    }

    const newPath = completePath.value
    const oldPath = String(props.collection?.name ?? '')
      .trim()
      .replace(/^\/+|\/+$/g, '')

    const encryptedName = await encryptString(
      newPath,
      orgKey.encKey,
      orgKey.macKey,
    )

    /*
     * Alle untergeordneten Sammlungen vorbereiten, bevor die
     * erste Änderung an Vaultwarden gesendet wird.
     */
    const descendantUpdates = []

    if (
      props.collection
      && oldPath
      && oldPath !== newPath
    ) {
      const oldPrefix = `${oldPath}/`

      const descendants = props.collections
        .filter(candidate =>
          normalizeId(candidate.organizationId)
            === normalizeId(organizationId.value),
        )
        .filter(candidate =>
          normalizeId(candidate.id)
            !== normalizeId(props.collection.id),
        )
        .filter(candidate =>
          String(candidate.name).startsWith(oldPrefix),
        )
        .sort((a, b) =>
          String(a.name).localeCompare(
            String(b.name),
            'de',
            {
              sensitivity: 'base',
              numeric: true,
            },
          ),
        )

      for (const descendant of descendants) {
        const relativePath = String(descendant.name)
          .slice(oldPrefix.length)

        const renamedPath = relativePath
          ? `${newPath}/${relativePath}`
          : newPath

        const encryptedDescendantName = await encryptString(
          renamedPath,
          orgKey.encKey,
          orgKey.macKey,
        )

        const descendantPayload =
          await buildCollectionUpdatePayload(
            descendant.id,
            encryptedDescendantName,
          )

        descendantUpdates.push({
          collection: descendant,
          payload: descendantPayload,
          renamedPath,
        })
      }
    }

    let raw

    if (props.collection) {
      const payload = await buildCollectionUpdatePayload(
        props.collection.id,
        encryptedName,
      )

      raw = await BitwardenApi.updateCollection(
        organizationId.value,
        props.collection.id,
        payload,
      )

      /*
       * Nach der übergeordneten Sammlung sämtliche Nachkommen
       * auf den neuen vollständigen Pfad umstellen.
       */
      for (const update of descendantUpdates) {
        await BitwardenApi.updateCollection(
          organizationId.value,
          update.collection.id,
          update.payload,
        )
      }
    } else {
      raw = await BitwardenApi.createCollection(
        organizationId.value,
        {
          name: encryptedName,
          groups: [],
          users: [],
          externalId: null,
        },
      )
    }

    const returnedName = responseValue(
      raw,
      'Name',
      'name',
    )

    if (!returnedName) {
      throw new Error(
        'Vaultwarden hat keine vollständige Sammlung zurückgegeben.',
      )
    }

    const decryptedName = await decryptEncString(
      returnedName,
      orgKey.encKey,
      orgKey.macKey,
    )

    emit('saved', {
      id:
        responseValue(raw, 'Id', 'id')
        ?? props.collection?.id,

      organizationId:
        responseValue(
          raw,
          'OrganizationId',
          'organizationId',
        )
        ?? organizationId.value,

      name: decryptedName,

      readOnly:
        responseValue(raw, 'ReadOnly', 'readOnly')
        ?? props.collection?.readOnly
        ?? false,

      hidePasswords:
        responseValue(
          raw,
          'HidePasswords',
          'hidePasswords',
        )
        ?? props.collection?.hidePasswords
        ?? false,

      manage:
        responseValue(raw, 'Manage', 'manage')
        ?? props.collection?.manage
        ?? false,

      type:
        responseValue(raw, 'Type', 'type')
        ?? props.collection?.type
        ?? 0,
    })
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Sammlung konnte nicht gespeichert werden:',
      exception,
    )

    error.value =
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || 'Die Sammlung konnte nicht gespeichert werden.'
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-collection-dialog {
  display: flex;
  min-width: 380px;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

.bw-collection-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.bw-collection-dialog__field label {
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
  font-weight: 600;
}

.bw-collection-dialog__field select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-collection-dialog__preview {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-collection-dialog__preview strong {
  color: var(--color-main-text);
}

.bw-collection-dialog__error {
  margin: 0;
  color: var(--color-error);
}
</style>
