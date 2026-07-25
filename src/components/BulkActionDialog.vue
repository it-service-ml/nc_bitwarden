<template>
  <NcDialog
    :name="dialogTitle"
    size="normal"
    @closing="$emit('close')"
  >
    <div class="bw-bulk-dialog">
      <p class="bw-bulk-dialog__summary">
        {{ t(
          'nc_bitwarden',
          '{count} items selected',
          { count: items.length },
        ) }}
      </p>

      <template v-if="mode === 'folder'">
        <label
          class="bw-bulk-dialog__label"
          for="bw-bulk-folder"
        >
          {{ t('nc_bitwarden', 'Personal folder') }}
        </label>

        <select
          id="bw-bulk-folder"
          v-model="folderId"
          class="bw-bulk-dialog__select"
        >
          <option value="__choose__" disabled>
            {{ t('nc_bitwarden', 'Choose a folder') }}
          </option>
          <option value="__none__">
            {{ t('nc_bitwarden', 'No personal folder') }}
          </option>
          <option
            v-for="folder in sortedFolders"
            :key="folder.id"
            :value="folder.id"
          >
            {{ folder.name }}
          </option>
        </select>
      </template>

      <template v-else>
        <NcNoteCard
          v-if="!collectionSelectionAllowed"
          type="warning"
        >
          {{ t(
            'nc_bitwarden',
            'Items from different organizations cannot be changed together.',
          ) }}
        </NcNoteCard>

        <template v-else-if="transferMode">
          <NcNoteCard type="warning">
            {{ t(
              'nc_bitwarden',
              '{count} personal items will be moved to an organization. Authorized members may then access the complete items, including attachments and passkeys.',
              {
                count: personalItemCount,
              },
            ) }}
          </NcNoteCard>

          <template v-if="!fixedOrganizationId">
            <label
              class="bw-bulk-dialog__label"
              for="bw-bulk-organization"
            >
              {{
                t(
                  'nc_bitwarden',
                  'Target organization',
                )
              }}
            </label>

            <select
              id="bw-bulk-organization"
              v-model="selectedOrganizationId"
              class="bw-bulk-dialog__select"
              @change="
                targetCollectionId =
                  '__choose__'
              "
            >
              <option
                value="__choose__"
                disabled
              >
                {{
                  t(
                    'nc_bitwarden',
                    'Choose an organization',
                  )
                }}
              </option>

              <option
                v-for="
                  organization
                    in availableOrganizations
                "
                :key="organization.id"
                :value="organization.id"
              >
                {{ organization.name }}
              </option>
            </select>
          </template>

          <p
            v-else
            class="bw-bulk-dialog__organization"
          >
            {{
              t(
                'nc_bitwarden',
                'Target organization: {name}',
                {
                  name:
                    targetOrganizationName,
                },
              )
            }}
          </p>

          <label
            class="bw-bulk-dialog__label"
            for="bw-bulk-target-collection"
          >
            {{
              t(
                'nc_bitwarden',
                'Target collection',
              )
            }}
          </label>

          <select
            id="bw-bulk-target-collection"
            v-model="targetCollectionId"
            class="bw-bulk-dialog__select"
            :disabled="!targetOrganizationId"
          >
            <option
              value="__choose__"
              disabled
            >
              {{
                t(
                  'nc_bitwarden',
                  'Choose a collection',
                )
              }}
            </option>

            <option
              v-for="
                collection
                  in availableCollections
              "
              :key="collection.id"
              :value="collection.id"
            >
              {{ collection.name }}
            </option>
          </select>

          <p
            v-if="
              targetOrganizationId
                && availableCollections.length === 0
            "
            class="bw-bulk-dialog__empty"
          >
            {{
              t(
                'nc_bitwarden',
                'No writable collections are available for this organization.',
              )
            }}
          </p>
        </template>

        <template v-else>
          <p class="bw-bulk-dialog__hint">
            {{ t(
              'nc_bitwarden',
              'The selected collections replace the current collection assignment for all selected items.',
            ) }}
          </p>

          <div class="bw-bulk-dialog__collections">
            <label
              v-for="
                collection
                  in availableCollections
              "
              :key="collection.id"
              class="bw-bulk-dialog__collection"
            >
              <input
                v-model="collectionIds"
                type="checkbox"
                :value="collection.id"
              >
              <span>{{ collection.name }}</span>
            </label>

            <p
              v-if="
                availableCollections.length === 0
              "
              class="bw-bulk-dialog__empty"
            >
              {{ t(
                'nc_bitwarden',
                'No collections are available for this organization.',
              ) }}
            </p>
          </div>
        </template>
      </template>

      <div class="bw-bulk-dialog__actions">
        <NcButton @click="$emit('close')">
          {{ t('nc_bitwarden', 'Cancel') }}
        </NcButton>

        <NcButton
          variant="primary"
          :disabled="!canApply"
          @click="apply"
        >
          {{ t('nc_bitwarden', 'Apply') }}
        </NcButton>
      </div>
    </div>
  </NcDialog>
</template>

<script setup>
import { computed, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'

const props = defineProps({
  mode: {
    type: String,
    required: true,
  },
  items: {
    type: Array,
    default: () => [],
  },
  folders: {
    type: Array,
    default: () => [],
  },
  collections: {
    type: Array,
    default: () => [],
  },

  organizations: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'close',
  'apply',
])

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

const nameCollator = new Intl.Collator(
  undefined,
  {
    sensitivity: 'base',
    numeric: true,
  },
)

const sortedFolders = computed(() =>
  [...props.folders].sort((left, right) =>
    nameCollator.compare(
      left.name ?? '',
      right.name ?? '',
    ),
  ),
)

const personalItemCount = computed(() =>
  props.items.filter(item =>
    !normalizeId(item.organizationId),
  ).length,
)

const transferMode = computed(() =>
  personalItemCount.value > 0,
)

const existingOrganizationIds = computed(() =>
  [...new Set(
    props.items
      .map(item =>
        normalizeId(item.organizationId),
      )
      .filter(Boolean),
  )],
)

const collectionSelectionAllowed = computed(() =>
  existingOrganizationIds.value.length <= 1,
)

const fixedOrganizationId = computed(() =>
  existingOrganizationIds.value.length === 1
    ? existingOrganizationIds.value[0]
    : '',
)

const availableOrganizations = computed(() =>
  [...props.organizations]
    .filter(organization =>
      props.collections.some(collection =>
        normalizeId(collection.organizationId)
          === normalizeId(organization.id)
        && !collection.readOnly,
      ),
    )
    .sort((left, right) =>
      nameCollator.compare(
        left.name ?? '',
        right.name ?? '',
      ),
    ),
)

const selectedOrganizationId = ref(
  fixedOrganizationId.value
    || '__choose__',
)

const targetOrganizationId = computed(() => {
  if (fixedOrganizationId.value) {
    return fixedOrganizationId.value
  }

  return selectedOrganizationId.value
    === '__choose__'
    ? ''
    : normalizeId(
      selectedOrganizationId.value,
    )
})

const targetOrganizationName = computed(() =>
  props.organizations.find(organization =>
    normalizeId(organization.id)
      === targetOrganizationId.value,
  )?.name
  || targetOrganizationId.value,
)

const availableCollections = computed(() =>
  props.collections
    .filter(collection =>
      normalizeId(collection.organizationId)
        === targetOrganizationId.value
      && !collection.readOnly,
    )
    .sort((left, right) =>
      nameCollator.compare(
        left.name ?? '',
        right.name ?? '',
      ),
    ),
)

function initialCommonCollectionIds() {
  if (
    props.items.length === 0
    || transferMode.value
    || !collectionSelectionAllowed.value
  ) {
    return []
  }

  const first = new Set(
    (props.items[0].collectionIds ?? [])
      .map(normalizeId),
  )

  return props.collections
    .filter(collection =>
      first.has(normalizeId(collection.id))
      && props.items.every(item =>
        (item.collectionIds ?? []).some(collectionId =>
          normalizeId(collectionId)
            === normalizeId(collection.id),
        ),
      ),
    )
    .map(collection => collection.id)
}

const folderId = ref('__choose__')
const collectionIds = ref(initialCommonCollectionIds())

const targetCollectionId = ref('__choose__')

const dialogTitle = computed(() =>
  props.mode === 'folder'
    ? t('nc_bitwarden', 'Change personal folder')
    : t('nc_bitwarden', 'Change collections'),
)

const canApply = computed(() => {
  if (props.items.length === 0) {
    return false
  }

  if (props.mode === 'folder') {
    return folderId.value !== '__choose__'
  }

  if (
    !collectionSelectionAllowed.value
    || !targetOrganizationId.value
  ) {
    return false
  }

  if (transferMode.value) {
    return (
      targetCollectionId.value
        !== '__choose__'
      && availableCollections.value.some(
        collection =>
          normalizeId(collection.id)
            === normalizeId(
              targetCollectionId.value,
            ),
      )
    )
  }

  return true
})

function apply() {
  if (!canApply.value) {
    return
  }

  emit('apply', {
    mode: props.mode,
    itemIds: props.items.map(item => item.id),
    folderId: folderId.value === '__none__'
      ? null
      : folderId.value,
    collectionIds: [...collectionIds.value],

    transferCollectionId:
      transferMode.value
        ? targetCollectionId.value
        : null,

    targetOrganizationId:
      targetOrganizationId.value,
  })
}
</script>

<style scoped>
.bw-bulk-dialog {
  display: flex;
  width: min(560px, 80vw);
  max-width: 100%;
  flex-direction: column;
  gap: 0.85rem;
  overflow-x: hidden;
}

.bw-bulk-dialog__summary,
.bw-bulk-dialog__hint,
.bw-bulk-dialog__empty {
  margin: 0;
}

.bw-bulk-dialog__summary {
  font-weight: 600;
}

.bw-bulk-dialog__hint,
.bw-bulk-dialog__empty {
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
}

.bw-bulk-dialog__label {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.bw-bulk-dialog__select {
  width: 100%;
  min-height: 42px;
  padding: 0 0.65rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-bulk-dialog__collections {
  display: flex;
  max-height: 320px;
  flex-direction: column;
  gap: 0.3rem;
  overflow-y: auto;
  padding: 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
}

.bw-bulk-dialog__collection {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.55rem;
  border-radius: var(--border-radius);
  cursor: pointer;
}

.bw-bulk-dialog__collection:hover {
  background: var(--color-background-hover);
}

.bw-bulk-dialog__actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  padding-top: 0.4rem;
}

.bw-bulk-dialog__organization {
  margin: 0;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-background-hover);
  font-weight: 600;
}

.bw-bulk-dialog {
  box-sizing: border-box;
  padding: 0 0.75rem 1rem;
}

.bw-bulk-dialog__actions {
  flex-wrap: wrap;
  padding-top: 0.75rem;
  padding-right: 0.15rem;
  padding-bottom: 0.15rem;
}

@media (max-width: 520px) {
  .bw-bulk-dialog {
    padding-right: 0.5rem;
    padding-bottom: 0.75rem;
    padding-left: 0.5rem;
  }

  .bw-bulk-dialog__actions {
    width: 100%;
  }
}

</style>
