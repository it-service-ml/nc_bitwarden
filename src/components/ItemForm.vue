<template>
  <NcDialog
    :name="isEdit
      ? t('nc_bitwarden', 'Edit item')
      : t('nc_bitwarden', 'New item')"
    size="normal"
    @close="$emit('close')"
  >
    <div class="bw-form">
      <div class="bw-form__field">
        <label class="bw-form__label">
          {{ t('nc_bitwarden', 'Type') }}
        </label>

        <div class="bw-form__radio-group">
          <NcCheckboxRadioSwitch
            v-for="typeOption in typeOptions"
            :key="typeOption.id"
            v-model="selectedType"
            :value="typeOption.id"
            name="item_type"
            type="radio"
            :disabled="isEdit"
          >
            <span class="bw-form__type-option">
              <component
                :is="typeOption.icon"
                :size="18"
              />
              {{ typeOption.label }}
            </span>
          </NcCheckboxRadioSwitch>
        </div>
      </div>

      <NcTextField
        v-model="form.name"
        :label="t('nc_bitwarden', 'Name *')"
        class="bw-form__field"
      />

      <div class="bw-form__field">
        <label
          class="bw-form__label"
          for="bw-item-organization"
        >
          {{ t('nc_bitwarden', 'Vault / organization') }}
        </label>

        <select
          id="bw-item-organization"
          v-model="form.organizationId"
          class="bw-form__select"
          :disabled="isEdit"
        >
          <option value="">
            {{ t('nc_bitwarden', 'Personal vault') }}
          </option>

          <option
            v-for="organization in organizationOptions"
            :key="organization.id"
            :value="organization.id"
          >
            {{ organization.name }}
          </option>
        </select>

        <small
          v-if="isEdit"
          class="bw-form__hint"
        >
          {{ t(
            'nc_bitwarden',
            'The owner of an existing item cannot be changed here.',
          ) }}
        </small>
      </div>

      <div
        v-if="form.organizationId"
        class="bw-form__field"
      >
        <label
          class="bw-form__label"
          for="bw-item-collection-search"
        >
          {{ t('nc_bitwarden', 'Collections') }}
        </label>

        <div class="bw-form__collection-search">
          <MagnifyIcon :size="18" />

          <input
            id="bw-item-collection-search"
            v-model="collectionSearch"
            type="search"
            :placeholder="t('nc_bitwarden', 'Search collections…')"
            autocomplete="off"
          >

          <button
            v-if="collectionSearch"
            type="button"
            :title="t('nc_bitwarden', 'Clear collection search')"
            :aria-label="t('nc_bitwarden', 'Clear collection search')"
            @click="collectionSearch = ''"
          >
            <CloseIcon :size="17" />
          </button>
        </div>

        <div class="bw-form__collection-summary">
          {{ t(
            'nc_bitwarden',
            'Selected: {selected} · Results: {results} · Total: {total}',
            {
              selected: selectedCollections.length,
              results: collectionResults.length,
              total: availableCollections.length,
            },
          ) }}
        </div>

        <div class="bw-form__collections">
          <section
            v-if="selectedCollections.length > 0"
            class="bw-form__collection-group"
          >
            <h4>{{ t('nc_bitwarden', 'Selected') }}</h4>

            <label
              v-for="collection in selectedCollections"
              :key="`selected-${collection.id}`"
              class="bw-form__collection"
            >
              <input
                v-model="form.collectionIds"
                type="checkbox"
                :value="collection.id"
                :disabled="collection.readOnly"
              >

              <span class="bw-form__collection-text">
                <strong>
                  {{ collectionParts(collection).label }}
                </strong>

                <small v-if="collectionParts(collection).parent">
                  {{ collectionParts(collection).parent }}
                </small>
              </span>
            </label>
          </section>

          <section class="bw-form__collection-group">
            <h4>
              {{ collectionSearch
                ? t('nc_bitwarden', 'Results')
                : t('nc_bitwarden', 'Available')
              }}
            </h4>

            <label
              v-for="collection in collectionResults"
              :key="`result-${collection.id}`"
              class="bw-form__collection"
            >
              <input
                v-model="form.collectionIds"
                type="checkbox"
                :value="collection.id"
              >

              <span class="bw-form__collection-text">
                <strong>
                  {{ collectionParts(collection).label }}
                </strong>

                <small v-if="collectionParts(collection).parent">
                  {{ collectionParts(collection).parent }}
                </small>
              </span>
            </label>

            <p
              v-if="collectionResults.length === 0"
              class="bw-form__collection-empty"
            >
              {{ t(
                'nc_bitwarden',
                'No matching writable collection was found.',
              ) }}
            </p>
          </section>
        </div>

        <small class="bw-form__hint">
          {{ t(
            'nc_bitwarden',
            'The full path is searched. An organization item must be assigned to at least one collection.',
          ) }}
        </small>
      </div>

      <div class="bw-form__field">
        <label
          class="bw-form__label"
          for="bw-item-folder"
        >
          {{ t('nc_bitwarden', 'Personal folder') }}
        </label>

        <select
          id="bw-item-folder"
          v-model="form.folderId"
          class="bw-form__select"
        >
          <option value="">
            {{ t(
              'nc_bitwarden',
              'No personal folder selected',
            ) }}
          </option>

          <option
            v-for="folder in sortedFolders"
            :key="folder.id"
            :value="folder.id"
          >
            {{ folder.name }}
          </option>
        </select>
      </div>

      <template v-if="selectedType === 1">
        <NcTextField
          v-model="form.username"
          :label="t('nc_bitwarden', 'Username')"
          class="bw-form__field"
        />

        <NcPasswordField
          v-model="form.password"
          :label="t('nc_bitwarden', 'Password')"
          class="bw-form__field"
        />

        <PasswordGenerator v-model="form.password" />

        <NcTextField
          v-model="form.uri"
          :label="t('nc_bitwarden', 'URL')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.totp"
          :label="t('nc_bitwarden', 'TOTP (optional)')"
          class="bw-form__field"
        />
      </template>

      <template v-if="selectedType === 2">
        <div class="bw-form__field">
          <label class="bw-form__label">
            {{ t('nc_bitwarden', 'Note') }}
          </label>

          <textarea
            v-model="form.notes"
            class="bw-form__textarea"
            rows="6"
          />
        </div>
      </template>

      <template v-if="selectedType === 3">
        <NcTextField
          v-model="form.cardholderName"
          :label="t('nc_bitwarden', 'Cardholder')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.cardNumber"
          :label="t('nc_bitwarden', 'Card number')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.expMonth"
          :label="t('nc_bitwarden', 'Month (MM)')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.expYear"
          :label="t('nc_bitwarden', 'Year (YYYY)')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.cvv"
          :label="t('nc_bitwarden', 'CVV')"
          class="bw-form__field"
        />
      </template>

      <template v-if="selectedType === 4">
        <NcTextField
          v-model="form.firstName"
          :label="t('nc_bitwarden', 'First name')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.lastName"
          :label="t('nc_bitwarden', 'Last name')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.idEmail"
          :label="t('nc_bitwarden', 'Email')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.phone"
          :label="t('nc_bitwarden', 'Phone')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.address"
          :label="t('nc_bitwarden', 'Address')"
          class="bw-form__field"
        />

        <NcTextField
          v-model="form.company"
          :label="t('nc_bitwarden', 'Company')"
          class="bw-form__field"
        />
      </template>

      <NcCheckboxRadioSwitch
        v-model="form.favorite"
        type="checkbox"
      >
        {{ t('nc_bitwarden', 'Mark as favorite') }}
      </NcCheckboxRadioSwitch>

      <p
        v-if="error"
        class="bw-form__error"
      >
        {{ error }}
      </p>
    </div>

    <template #actions>
      <NcButton @click="$emit('close')">
        {{ t('nc_bitwarden', 'Cancel') }}
      </NcButton>

      <NcButton
        type="primary"
        :disabled="saving || !canSave"
        @click="save"
      >
        {{ saving
          ? t('nc_bitwarden', 'Saving…')
          : t('nc_bitwarden', 'Save')
        }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import PasswordGenerator from './PasswordGenerator.vue'
import {
  computed,
  reactive,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import MagnifyIcon from 'vue-material-design-icons/Magnify.vue'
import CloseIcon from 'vue-material-design-icons/Close.vue'
import { VaultwardenApi } from '../services/api.js'
import {
  decryptCipher,
  encryptString,
} from '../services/crypto.js'
import {
  collectionMatchesQuery,
  collectionNameParts,
} from '../utils/collectionSearch.js'

const props = defineProps({
  userKey: {
    type: Object,
    required: true,
  },
  item: {
    type: Object,
    default: null,
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
  organizationKeys: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits(['saved', 'close'])

const saving = ref(false)
const error = ref('')
const collectionSearch = ref('')
const isEdit = computed(() => Boolean(props.item?.id))
const selectedType = ref(Number(props.item?.type ?? 1))

const initialCollectionIds = [
  ...(props.item?.collectionIds ?? []),
]

const form = reactive({
  name: props.item?.name ?? '',
  organizationId: props.item?.organizationId ?? '',
  collectionIds: [...initialCollectionIds],
  folderId: props.item?.folderId ?? '',
  favorite: Boolean(props.item?.favorite),

  username: props.item?.login?.username ?? '',
  password: props.item?.login?.password ?? '',
  uri: props.item?.login?.uris?.[0]?.uri ?? '',
  totp: props.item?.login?.totp ?? '',

  notes: props.item?.notes ?? '',

  cardholderName: props.item?.card?.cardholderName ?? '',
  cardNumber: props.item?.card?.number ?? '',
  expMonth: props.item?.card?.expMonth ?? '',
  expYear: props.item?.card?.expYear ?? '',
  cvv: props.item?.card?.code ?? '',

  firstName: props.item?.identity?.firstName ?? '',
  lastName: props.item?.identity?.lastName ?? '',
  idEmail: props.item?.identity?.email ?? '',
  phone: props.item?.identity?.phone ?? '',
  address: props.item?.identity?.address1 ?? '',
  company: props.item?.identity?.company ?? '',
})

const nameCollator = new Intl.Collator(undefined, {
  sensitivity: 'base',
  numeric: true,
})

const typeOptions = [
  {
    id: 1,
    label: t('nc_bitwarden', 'Login'),
    icon: KeyOutlineIcon,
  },
  {
    id: 2,
    label: t('nc_bitwarden', 'Secure note'),
    icon: NoteTextOutlineIcon,
  },
  {
    id: 3,
    label: t('nc_bitwarden', 'Card'),
    icon: CreditCardOutlineIcon,
  },
  {
    id: 4,
    label: t('nc_bitwarden', 'Identity'),
    icon: IdentityOutlineIcon,
  },
]

const sortedFolders = computed(() =>
  [...props.folders].sort((left, right) =>
    nameCollator.compare(
      left.name ?? '',
      right.name ?? '',
    ),
  ),
)

const organizationOptions = computed(() =>
  props.organizations
    .filter(organization => {
      const organizationId = normalizeId(organization.id)

      return (
        organizationId === normalizeId(form.organizationId)
        || props.collections.some(collection =>
          normalizeId(collection.organizationId)
            === organizationId
          && !collection.readOnly,
        )
      )
    })
    .sort((left, right) =>
      nameCollator.compare(
        left.name ?? '',
        right.name ?? '',
      ),
    ),
)

const availableCollections = computed(() =>
  props.collections
    .filter(collection =>
      normalizeId(collection.organizationId)
        === normalizeId(form.organizationId),
    )
    .filter(collection =>
      !collection.readOnly
      || collectionIsSelected(collection.id),
    )
    .sort((left, right) =>
      nameCollator.compare(
        left.name ?? '',
        right.name ?? '',
      ),
    ),
)

const selectedCollections = computed(() =>
  availableCollections.value.filter(collection =>
    collectionIsSelected(collection.id),
  ),
)

const collectionResults = computed(() =>
  availableCollections.value
    .filter(collection =>
      !collectionIsSelected(collection.id),
    )
    .filter(collection =>
      !collection.readOnly,
    )
    .filter(collection =>
      collectionMatchesQuery(
        collection,
        collectionSearch.value,
      ),
    ),
)

const canSave = computed(() => {
  if (!form.name.trim()) {
    return false
  }

  if (
    form.organizationId
    && form.collectionIds.length === 0
  ) {
    return false
  }

  return Boolean(getEncryptionKey())
})

watch(
  () => form.organizationId,
  (nextOrganizationId, previousOrganizationId) => {
    if (
      normalizeId(nextOrganizationId)
      === normalizeId(previousOrganizationId)
    ) {
      return
    }

    form.collectionIds = []
    collectionSearch.value = ''
  },
)

function normalizeId(value) {
  if (
    value === null
    || value === undefined
    || value === ''
  ) {
    return null
  }

  return String(value).trim().toLowerCase()
}

function collectionParts(collection) {
  return collectionNameParts(collection)
}

function collectionIsSelected(collectionId) {
  const normalizedCollectionId = normalizeId(collectionId)

  return form.collectionIds.some(selectedId =>
    normalizeId(selectedId) === normalizedCollectionId,
  )
}

function getOrganizationKey(organizationId) {
  if (!organizationId) {
    return null
  }

  if (props.organizationKeys[organizationId]) {
    return props.organizationKeys[organizationId]
  }

  const match = Object.entries(props.organizationKeys)
    .find(([candidateId]) =>
      normalizeId(candidateId)
        === normalizeId(organizationId),
    )

  return match?.[1] ?? null
}

function originalOrganizationId() {
  return props.item?.organizationId
    ?? props.item?.OrganizationId
    ?? props.item?.organizationID
    ?? props.item?.OrganizationID
    ?? null
}

function effectiveOrganizationId() {
  if (isEdit.value) {
    return originalOrganizationId()
      ?? form.organizationId
      ?? null
  }

  return form.organizationId || null
}

function getEncryptionKey() {
  const organizationId = effectiveOrganizationId()

  return organizationId
    ? getOrganizationKey(organizationId)
    : props.userKey
}

async function encrypt(value, key) {
  return encryptString(
    value,
    key.encKey,
    key.macKey,
  )
}

async function buildPayload() {
  const encryptionKey = getEncryptionKey()

  if (!encryptionKey) {
    throw new Error(
      t(
        'nc_bitwarden',
        'The required encryption key is not available.',
      ),
    )
  }

  const payload = {
    type: Number(selectedType.value),
    name: await encrypt(form.name.trim(), encryptionKey),
    notes: form.notes
      ? await encrypt(form.notes, encryptionKey)
      : null,
    favorite: Boolean(form.favorite),
    folderId: form.folderId || null,
    organizationId: effectiveOrganizationId(),
    fields: [],
    reprompt: 0,
  }

  if (selectedType.value === 1) {
    payload.login = {
      username: form.username
        ? await encrypt(form.username, encryptionKey)
        : null,
      password: form.password
        ? await encrypt(form.password, encryptionKey)
        : null,
      totp: form.totp
        ? await encrypt(form.totp, encryptionKey)
        : null,
      uris: form.uri
        ? [{
          uri: await encrypt(form.uri, encryptionKey),
          match: null,
        }]
        : [],
    }
  } else if (selectedType.value === 2) {
    payload.secureNote = {
      type: 0,
    }
  } else if (selectedType.value === 3) {
    payload.card = {
      cardholderName: form.cardholderName
        ? await encrypt(form.cardholderName, encryptionKey)
        : null,
      number: form.cardNumber
        ? await encrypt(form.cardNumber, encryptionKey)
        : null,
      expMonth: form.expMonth
        ? await encrypt(form.expMonth, encryptionKey)
        : null,
      expYear: form.expYear
        ? await encrypt(form.expYear, encryptionKey)
        : null,
      code: form.cvv
        ? await encrypt(form.cvv, encryptionKey)
        : null,
    }
  } else if (selectedType.value === 4) {
    payload.identity = {
      firstName: form.firstName
        ? await encrypt(form.firstName, encryptionKey)
        : null,
      lastName: form.lastName
        ? await encrypt(form.lastName, encryptionKey)
        : null,
      email: form.idEmail
        ? await encrypt(form.idEmail, encryptionKey)
        : null,
      phone: form.phone
        ? await encrypt(form.phone, encryptionKey)
        : null,
      address1: form.address
        ? await encrypt(form.address, encryptionKey)
        : null,
      company: form.company
        ? await encrypt(form.company, encryptionKey)
        : null,
    }
  }

  return payload
}

function normalizedIdList(values) {
  return [...new Set(
    (values ?? [])
      .map(normalizeId)
      .filter(Boolean),
  )].sort()
}

function collectionSelectionChanged() {
  return JSON.stringify(
    normalizedIdList(initialCollectionIds),
  ) !== JSON.stringify(
    normalizedIdList(form.collectionIds),
  )
}

function toPascal(value) {
  if (Array.isArray(value)) {
    return value.map(toPascal)
  }

  if (
    value !== null
    && typeof value === 'object'
  ) {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => [
        key.charAt(0).toUpperCase() + key.slice(1),
        toPascal(itemValue),
      ]),
    )
  }

  return value
}

async function save() {
  if (saving.value || !canSave.value) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const payload = await buildPayload()

    let raw

    if (isEdit.value) {
      raw = await VaultwardenApi.updateCipher(
        props.item.id,
        payload,
      )

      if (effectiveOrganizationId() && collectionSelectionChanged()) {
        await VaultwardenApi.updateCipherCollections(
          props.item.id,
          form.collectionIds,
        )
      }
    } else if (form.organizationId) {
      raw = await VaultwardenApi.createOrganizationCipher({
        cipher: payload,
        collectionIds: form.collectionIds,
      })
    } else {
      raw = await VaultwardenApi.createCipher(payload)
    }

    const decrypted = await decryptCipher(
      toPascal(raw),
      props.userKey,
      props.organizationKeys,
    )

    emit('saved', decrypted)
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Item could not be saved:',
      exception,
    )

    error.value = exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The item could not be saved.',
      )
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-form__field {
  margin-bottom: 0.75rem;
}

.bw-form__label {
  display: block;
  margin-bottom: 0.25rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.bw-form__type-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.bw-form__radio-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bw-form__select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-form__collection-search {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.55rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-form__collection-search input {
  min-width: 0;
  flex: 1;
  padding: 0.15rem;
  border: none;
  outline: none;
  background: transparent;
  color: var(--color-main-text);
}

.bw-form__collection-search button {
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  cursor: pointer;
}

.bw-form__collection-search button:hover {
  background: var(--color-background-hover);
}

.bw-form__collection-summary {
  padding: 0.4rem 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
}

.bw-form__collections {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  scrollbar-gutter: stable;
}

.bw-form__collection-group h4 {
  position: sticky;
  top: 0;
  z-index: 1;
  margin: 0;
  padding: 0.45rem 0.6rem;
  background: var(--color-background-dark);
  color: var(--color-text-maxcontrast);
  font-size: 0.7rem;
  text-transform: uppercase;
}

.bw-form__collection {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.45rem 0.6rem;
  cursor: pointer;
}

.bw-form__collection:hover {
  background: var(--color-background-hover);
}

.bw-form__collection-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
}

.bw-form__collection-text strong,
.bw-form__collection-text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-form__collection-text small {
  color: var(--color-text-maxcontrast);
  font-size: 0.72rem;
}

.bw-form__collection-empty {
  margin: 0;
  padding: 0.75rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

.bw-form__hint {
  display: block;
  margin-top: 0.3rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
}

.bw-form__error {
  margin: 0.75rem 0 0;
  color: var(--color-error);
}

.bw-form__textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font-family: inherit;
  resize: vertical;
}
</style>
