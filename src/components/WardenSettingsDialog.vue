<template>
  <NcDialog
    :name="t('nc_bitwarden', 'Warden settings')"
    size="large"
    @closing="$emit('close')"
  >
    <div class="bw-warden-settings">
      <NcNoteCard
        v-if="saved"
        type="success"
      >
        {{ t('nc_bitwarden', 'Settings saved') }}
      </NcNoteCard>

      <NcNoteCard
        v-if="saveError"
        type="error"
      >
        {{ saveError }}
      </NcNoteCard>

      <section class="bw-warden-settings__section">
        <h3>{{ t('nc_bitwarden', 'Security') }}</h3>

        <div class="bw-warden-settings__password-change">
          <h4>{{ t('nc_bitwarden', 'Change master password') }}</h4>

          <NcNoteCard type="warning">
            {{
              t(
                'nc_bitwarden',
                'The current master password is required. There is no password reset if it is lost.',
              )
            }}
          </NcNoteCard>

          <NcPasswordField
            v-model="currentMasterPassword"
            :label="t('nc_bitwarden', 'Current master password')"
            autocomplete="current-password"
            :disabled="changingPassword"
          />

          <NcPasswordField
            v-model="newMasterPassword"
            :label="t('nc_bitwarden', 'New master password')"
            autocomplete="new-password"
            :disabled="changingPassword"
          />

          <NcPasswordField
            v-model="confirmMasterPassword"
            :label="t('nc_bitwarden', 'Repeat new master password')"
            autocomplete="new-password"
            :disabled="changingPassword"
          />

          <NcNoteCard
            v-if="passwordError"
            type="error"
          >
            {{ passwordError }}
          </NcNoteCard>

          <NcButton
            variant="secondary"
            :disabled="!canChangeMasterPassword"
            @click="changeMasterPassword"
          >
            {{
              changingPassword
                ? t('nc_bitwarden', 'Changing…')
                : t('nc_bitwarden', 'Change master password')
            }}
          </NcButton>
        </div>
      </section>

      <section class="bw-warden-settings__section">
        <h3>{{ t('nc_bitwarden', 'Display') }}</h3>

        <div class="bw-warden-settings__grid">
          <div class="bw-warden-settings__field">
            <label for="bw-start-category">
              {{ t('nc_bitwarden', 'Start area') }}
            </label>

            <select
              id="bw-start-category"
              v-model="form.start_category"
            >
              <option value="all">
                {{ t('nc_bitwarden', 'All items') }}
              </option>
              <option value="favorites">
                {{ t('nc_bitwarden', 'Favorites') }}
              </option>
              <option value="logins">
                {{ t('nc_bitwarden', 'Logins') }}
              </option>
              <option value="totp">
                {{ t('nc_bitwarden', 'TOTP') }}
              </option>
              <option value="ssh-keys">
                {{ t('nc_bitwarden', 'SSH keys') }}
              </option>
              <option value="notes">
                {{ t('nc_bitwarden', 'Secure notes') }}
              </option>
              <option value="cards">
                {{ t('nc_bitwarden', 'Cards') }}
              </option>
              <option value="identities">
                {{ t('nc_bitwarden', 'Identities') }}
              </option>
            </select>
          </div>

          <div class="bw-warden-settings__field">
            <label for="bw-navigation-mode">
              {{
                t(
                  'nc_bitwarden',
                  'Navigation at startup',
                )
              }}
            </label>

            <select
              id="bw-navigation-mode"
              v-model="form.navigation_start_mode"
            >
              <option value="collapsed">
                {{ t('nc_bitwarden', 'Everything collapsed') }}
              </option>
              <option value="personal_expanded">
                {{
                  t(
                    'nc_bitwarden',
                    'Categories and folders expanded, collections collapsed',
                  )
                }}
              </option>
              <option value="expanded">
                {{ t('nc_bitwarden', 'Everything expanded') }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <section class="bw-warden-settings__section">
        <h3>{{ t('nc_bitwarden', 'New items') }}</h3>

        <div class="bw-warden-settings__grid">
          <div class="bw-warden-settings__field">
            <label for="bw-default-target">
              {{ t('nc_bitwarden', 'Default destination') }}
            </label>

            <select
              id="bw-default-target"
              v-model="form.default_target_mode"
            >
              <option value="personal">
                {{ t('nc_bitwarden', 'Personal vault') }}
              </option>
              <option value="last_used">
                {{ t('nc_bitwarden', 'Last used destination') }}
              </option>
              <option value="fixed">
                {{
                  t(
                    'nc_bitwarden',
                    'Fixed organization and collection',
                  )
                }}
              </option>
            </select>
          </div>

          <div class="bw-warden-settings__field">
            <label for="bw-default-item-type">
              {{ t('nc_bitwarden', 'Default item type') }}
            </label>

            <select
              id="bw-default-item-type"
              v-model="form.default_item_type"
            >
              <option value="1">
                {{ t('nc_bitwarden', 'Login') }}
              </option>
              <option value="2">
                {{ t('nc_bitwarden', 'Secure note') }}
              </option>
              <option value="3">
                {{ t('nc_bitwarden', 'Card') }}
              </option>
              <option value="4">
                {{ t('nc_bitwarden', 'Identity') }}
              </option>
              <option value="5">
                {{ t('nc_bitwarden', 'SSH key') }}
              </option>
              <option value="last_used">
                {{ t('nc_bitwarden', 'Last used type') }}
              </option>
            </select>
          </div>
        </div>

        <div
          v-if="form.default_target_mode === 'fixed'"
          class="bw-warden-settings__grid"
        >
          <div class="bw-warden-settings__field">
            <label for="bw-default-organization">
              {{ t('nc_bitwarden', 'Organization') }}
            </label>

            <select
              id="bw-default-organization"
              v-model="form.default_organization_id"
            >
              <option value="">
                {{ t('nc_bitwarden', 'Select organization') }}
              </option>

              <option
                v-for="organization in organizationOptions"
                :key="organization.id"
                :value="organization.id"
              >
                {{ organization.name }}
              </option>
            </select>
          </div>

          <div class="bw-warden-settings__field">
            <label for="bw-default-collection">
              {{ t('nc_bitwarden', 'Collection') }}
            </label>

            <select
              id="bw-default-collection"
              v-model="form.default_collection_id"
              :disabled="!form.default_organization_id"
            >
              <option value="">
                {{ t('nc_bitwarden', 'Select collection') }}
              </option>

              <option
                v-for="collection in fixedCollections"
                :key="collection.id"
                :value="collection.id"
              >
                {{ collection.name }}
              </option>
            </select>
          </div>
        </div>
      </section>

      <section class="bw-warden-settings__section">
        <h3>{{ t('nc_bitwarden', 'Password generator') }}</h3>

        <div class="bw-warden-settings__field">
          <label for="bw-generator-mode">
            {{ t('nc_bitwarden', 'Default generator mode') }}
          </label>

          <select
            id="bw-generator-mode"
            v-model="form.generator_mode"
          >
            <option value="password">
              {{ t('nc_bitwarden', 'Password') }}
            </option>
            <option value="passphrase">
              {{ t('nc_bitwarden', 'Passphrase') }}
            </option>
          </select>
        </div>

        <div class="bw-warden-settings__generator-columns">
          <div>
            <h4>{{ t('nc_bitwarden', 'Password') }}</h4>

            <div class="bw-warden-settings__field">
              <label for="bw-password-length">
                {{ t('nc_bitwarden', 'Length') }}
              </label>
              <input
                id="bw-password-length"
                v-model.number="form.password_length"
                type="number"
                min="8"
                max="128"
              >
            </div>

            <div class="bw-warden-settings__switches">
              <NcCheckboxRadioSwitch
                v-model="form.password_use_lowercase"
                type="switch"
              >
                {{ t('nc_bitwarden', 'Lowercase letters') }}
              </NcCheckboxRadioSwitch>

              <NcCheckboxRadioSwitch
                v-model="form.password_use_uppercase"
                type="switch"
              >
                {{ t('nc_bitwarden', 'Uppercase letters') }}
              </NcCheckboxRadioSwitch>

              <NcCheckboxRadioSwitch
                v-model="form.password_use_digits"
                type="switch"
              >
                {{ t('nc_bitwarden', 'Numbers') }}
              </NcCheckboxRadioSwitch>

              <NcCheckboxRadioSwitch
                v-model="form.password_use_symbols"
                type="switch"
              >
                {{ t('nc_bitwarden', 'Special characters') }}
              </NcCheckboxRadioSwitch>

              <NcCheckboxRadioSwitch
                v-model="form.password_exclude_ambiguous"
                type="switch"
              >
                {{
                  t(
                    'nc_bitwarden',
                    'Exclude ambiguous characters',
                  )
                }}
              </NcCheckboxRadioSwitch>
            </div>
          </div>

          <div>
            <h4>{{ t('nc_bitwarden', 'Passphrase') }}</h4>

            <div class="bw-warden-settings__field">
              <label for="bw-passphrase-language">
                {{ t('nc_bitwarden', 'Word list language') }}
              </label>
              <select
                id="bw-passphrase-language"
                v-model="form.passphrase_language"
              >
                <option value="de">
                  {{ t('nc_bitwarden', 'German') }}
                </option>
                <option value="en">
                  {{ t('nc_bitwarden', 'English') }}
                </option>
              </select>
            </div>

            <div class="bw-warden-settings__field">
              <label for="bw-passphrase-word-count">
                {{ t('nc_bitwarden', 'Word count') }}
              </label>
              <input
                id="bw-passphrase-word-count"
                v-model.number="form.passphrase_word_count"
                type="number"
                min="4"
                max="8"
              >
            </div>

            <div class="bw-warden-settings__field">
              <label for="bw-passphrase-separator">
                {{ t('nc_bitwarden', 'Separator') }}
              </label>
              <select
                id="bw-passphrase-separator"
                v-model="form.passphrase_separator"
              >
                <option value="hyphen">
                  {{ t('nc_bitwarden', 'Hyphen') }}
                </option>
                <option value="space">
                  {{ t('nc_bitwarden', 'Space') }}
                </option>
                <option value="dot">
                  {{ t('nc_bitwarden', 'Dot') }}
                </option>
                <option value="underscore">
                  {{ t('nc_bitwarden', 'Underscore') }}
                </option>
              </select>
            </div>

            <div class="bw-warden-settings__field">
              <label for="bw-passphrase-capitalization">
                {{ t('nc_bitwarden', 'Capitalization') }}
              </label>
              <select
                id="bw-passphrase-capitalization"
                v-model="form.passphrase_capitalization"
              >
                <option value="lower">
                  {{ t('nc_bitwarden', 'Lowercase') }}
                </option>
                <option value="first">
                  {{
                    t(
                      'nc_bitwarden',
                      'First word capitalized',
                    )
                  }}
                </option>
                <option value="all">
                  {{
                    t(
                      'nc_bitwarden',
                      'Every word capitalized',
                    )
                  }}
                </option>
              </select>
            </div>

            <div class="bw-warden-settings__switches">
              <NcCheckboxRadioSwitch
                v-model="form.passphrase_include_number"
                type="switch"
              >
                {{ t('nc_bitwarden', 'Add random number') }}
              </NcCheckboxRadioSwitch>

              <NcCheckboxRadioSwitch
                v-model="form.passphrase_include_symbol"
                type="switch"
              >
                {{
                  t(
                    'nc_bitwarden',
                    'Add random special character',
                  )
                }}
              </NcCheckboxRadioSwitch>
            </div>
          </div>
        </div>
      </section>
    </div>

    <template #actions>
      <NcButton
        variant="secondary"
        :disabled="saving || changingPassword"
        @click="$emit('close')"
      >
        {{ t('nc_bitwarden', 'Close') }}
      </NcButton>

      <NcButton
        variant="primary"
        :disabled="saving || changingPassword"
        @click="savePreferences"
      >
        {{
          saving
            ? t('nc_bitwarden', 'Saving…')
            : t('nc_bitwarden', 'Save settings')
        }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import {
  computed,
  reactive,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import { VaultwardenApi } from '../services/api.js'
import {
  decryptUserSymmetricKey,
  deriveMasterKeyArgon2id,
  deriveMasterKeyPBKDF2,
  encryptUserSymmetricKey,
  makeMasterPasswordHash,
} from '../services/crypto.js'
import { normalizeUserPreferences } from '../services/userPreferences.js'

const props = defineProps({
  preferences: {
    type: Object,
    required: true,
  },
  userKey: {
    type: Object,
    required: true,
  },
  profile: {
    type: Object,
    default: () => ({}),
  },
  organizations: {
    type: Array,
    default: () => [],
  },
  collections: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits([
  'close',
  'saved',
  'password-changed',
])

const form = reactive(
  normalizeUserPreferences(props.preferences),
)

const saving = ref(false)
const saved = ref(false)
const saveError = ref('')

const currentMasterPassword = ref('')
const newMasterPassword = ref('')
const confirmMasterPassword = ref('')
const changingPassword = ref(false)
const passwordError = ref('')

watch(
  () => props.preferences,
  value => {
    Object.assign(
      form,
      normalizeUserPreferences(value),
    )
  },
  {
    deep: true,
  },
)

watch(
  () => form.default_organization_id,
  (nextValue, previousValue) => {
    if (nextValue !== previousValue) {
      form.default_collection_id = ''
    }
  },
)

const organizationOptions = computed(() =>
  props.organizations
    .filter(organization =>
      props.collections.some(collection =>
        normalizeId(collection.organizationId)
          === normalizeId(organization.id)
        && !collection.readOnly,
      ),
    )
    .sort((left, right) =>
      String(left.name ?? '').localeCompare(
        String(right.name ?? ''),
        undefined,
        {
          sensitivity: 'base',
          numeric: true,
        },
      ),
    ),
)

const fixedCollections = computed(() =>
  props.collections
    .filter(collection =>
      normalizeId(collection.organizationId)
        === normalizeId(form.default_organization_id),
    )
    .filter(collection => !collection.readOnly)
    .sort((left, right) =>
      String(left.name ?? '').localeCompare(
        String(right.name ?? ''),
        undefined,
        {
          sensitivity: 'base',
          numeric: true,
        },
      ),
    ),
)

const canChangeMasterPassword = computed(() => (
  !changingPassword.value
  && Boolean(currentMasterPassword.value)
  && Boolean(newMasterPassword.value)
  && newMasterPassword.value
    === confirmMasterPassword.value
  && newMasterPassword.value
    !== currentMasterPassword.value
))

function normalizeId(value) {
  return String(value ?? '').trim().toLowerCase()
}

function profileValue(pascalName, camelName) {
  return props.profile?.[pascalName]
    ?? props.profile?.[camelName]
    ?? null
}

function masterPasswordUnlockValue() {
  return props.profile?.UserDecryption
    ?.MasterPasswordUnlock
    ?? props.profile?.userDecryption
      ?.masterPasswordUnlock
    ?? {}
}

function unlockValue(pascalName, camelName) {
  const unlock = masterPasswordUnlockValue()

  return unlock?.[pascalName]
    ?? unlock?.[camelName]
    ?? null
}

function unlockKdfValue(pascalName, camelName) {
  const unlock = masterPasswordUnlockValue()
  const kdf = unlock?.Kdf ?? unlock?.kdf ?? {}

  return kdf?.[pascalName]
    ?? kdf?.[camelName]
    ?? null
}

function sameBuffer(left, right) {
  if (
    !(left instanceof ArrayBuffer)
    || !(right instanceof ArrayBuffer)
    || left.byteLength !== right.byteLength
  ) {
    return false
  }

  const leftBytes = new Uint8Array(left)
  const rightBytes = new Uint8Array(right)

  let difference = 0

  for (let index = 0; index < leftBytes.length; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index]
  }

  return difference === 0
}

function sameUserKey(left, right) {
  return Boolean(
    left
    && right
    && sameBuffer(left.encKey, right.encKey)
    && sameBuffer(left.macKey, right.macKey),
  )
}

async function deriveMasterKey(password) {
  const email = String(
    profileValue('Email', 'email')
      ?? unlockValue('Salt', 'salt')
      ?? '',
  ).trim().toLowerCase()

  const kdf = Number(
    profileValue('Kdf', 'kdf')
      ?? unlockKdfValue('KdfType', 'kdfType')
      ?? 0,
  )

  const iterations = Number(
    profileValue('KdfIterations', 'kdfIterations')
      ?? unlockKdfValue('Iterations', 'iterations'),
  )

  if (!email || !Number.isFinite(iterations)) {
    throw new Error(
      t(
        'nc_bitwarden',
        'The vault profile does not contain the data required to change the master password.',
      ),
    )
  }

  if (kdf === 1) {
    const memory = Number(
      profileValue('KdfMemory', 'kdfMemory')
        ?? unlockKdfValue('Memory', 'memory'),
    )

    const parallelism = Number(
      profileValue(
        'KdfParallelism',
        'kdfParallelism',
      )
        ?? unlockKdfValue(
          'Parallelism',
          'parallelism',
        ),
    )

    if (
      !Number.isFinite(memory)
      || !Number.isFinite(parallelism)
    ) {
      throw new Error(
        t(
          'nc_bitwarden',
          'The vault profile does not contain the data required to change the master password.',
        ),
      )
    }

    return deriveMasterKeyArgon2id(
      password,
      email,
      memory,
      iterations,
      parallelism,
    )
  }

  return deriveMasterKeyPBKDF2(
    password,
    email,
    iterations,
  )
}

async function savePreferences() {
  saving.value = true
  saved.value = false
  saveError.value = ''

  try {
    const normalized = normalizeUserPreferences(form)
    const persisted = await VaultwardenApi.savePreferences(
      normalized,
    )

    Object.assign(form, persisted)
    saved.value = true
    emit('saved', persisted)

    window.setTimeout(() => {
      saved.value = false
    }, 3000)
  } catch (exception) {
    saveError.value = exception.response?.data?.error
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'Failed to save settings',
      )
  } finally {
    saving.value = false
  }
}

async function changeMasterPassword() {
  passwordError.value = ''

  if (
    newMasterPassword.value
      !== confirmMasterPassword.value
  ) {
    passwordError.value = t(
      'nc_bitwarden',
      'The new master passwords do not match.',
    )
    return
  }

  if (
    newMasterPassword.value
      === currentMasterPassword.value
  ) {
    passwordError.value = t(
      'nc_bitwarden',
      'The new master password must be different from the current master password.',
    )
    return
  }

  changingPassword.value = true

  try {
    const encryptedUserKey =
      profileValue('Key', 'key')
      ?? unlockValue(
        'MasterKeyWrappedUserKey',
        'masterKeyWrappedUserKey',
      )
      ?? unlockValue(
        'MasterKeyEncryptedUserKey',
        'masterKeyEncryptedUserKey',
      )

    if (!encryptedUserKey) {
      throw new Error(
        t(
          'nc_bitwarden',
          'The encrypted user key is not available.',
        ),
      )
    }

    const currentMasterKey = await deriveMasterKey(
      currentMasterPassword.value,
    )

    const verifiedUserKey =
      await decryptUserSymmetricKey(
        encryptedUserKey,
        currentMasterKey,
      )

    if (!sameUserKey(verifiedUserKey, props.userKey)) {
      throw new Error(
        t(
          'nc_bitwarden',
          'The current master password is incorrect.',
        ),
      )
    }

    const newMasterKey = await deriveMasterKey(
      newMasterPassword.value,
    )

    const [
      masterPasswordHash,
      newMasterPasswordHash,
      rewrappedUserKey,
    ] = await Promise.all([
      makeMasterPasswordHash(
        currentMasterKey,
        currentMasterPassword.value,
      ),
      makeMasterPasswordHash(
        newMasterKey,
        newMasterPassword.value,
      ),
      encryptUserSymmetricKey(
        props.userKey,
        newMasterKey,
      ),
    ])

    await VaultwardenApi.changeMasterPassword({
      masterPasswordHash,
      newMasterPasswordHash,
      masterPasswordHint: null,
      key: rewrappedUserKey,
    })

    currentMasterPassword.value = ''
    newMasterPassword.value = ''
    confirmMasterPassword.value = ''

    emit('password-changed')
  } catch (exception) {
    passwordError.value = exception.response?.data?.error
      ?? exception.response?.data?.message
      ?? exception.message
      ?? t(
        'nc_bitwarden',
        'The master password could not be changed.',
      )
  } finally {
    changingPassword.value = false
  }
}
</script>

<style scoped>
.bw-warden-settings {
  display: flex;
  min-width: min(860px, 80vw);
  max-height: 72vh;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  padding: 1rem;
}

.bw-warden-settings__section {
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
}

.bw-warden-settings__section h3 {
  margin-top: 0;
}

.bw-warden-settings__section h4 {
  margin-bottom: 0.75rem;
}

.bw-warden-settings__grid,
.bw-warden-settings__generator-columns {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(240px, 1fr)
  );
  gap: 1rem;
}

.bw-warden-settings__field {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin-bottom: 0.75rem;
}

.bw-warden-settings__field > label {
  font-weight: 600;
}

.bw-warden-settings__field select,
.bw-warden-settings__field input[type='number'] {
  min-height: 38px;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-warden-settings__field small {
  color: var(--color-text-maxcontrast);
}

.bw-warden-settings__password-change {
  display: flex;
  max-width: 620px;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border);
}

.bw-warden-settings__requirements {
  margin: 0;
  padding-left: 1.25rem;
  color: var(--color-text-maxcontrast);
}

.bw-warden-settings__requirement--met {
  color: var(--color-success);
}

.bw-warden-settings__switches {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

@media (max-width: 900px) {
  .bw-warden-settings {
    min-width: 0;
    max-height: 75vh;
  }
}
</style>
