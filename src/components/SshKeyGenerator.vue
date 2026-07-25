<template>
  <section class="bw-ssh-generator">
    <div class="bw-ssh-generator__panel">
      <h3>
        {{ t('nc_bitwarden', 'Generate SSH key pair') }}
      </h3>

      <p class="bw-ssh-generator__hint">
        {{ t(
          'nc_bitwarden',
          'The key pair is generated entirely in this browser. The private key is encrypted only when the vault item is saved.',
        ) }}
      </p>

      <div class="bw-ssh-generator__algorithm">
        <label class="bw-ssh-generator__algorithm-option">
          <input
            v-model="algorithm"
            type="radio"
            value="ed25519"
          >

          <span>
            {{ t('nc_bitwarden', 'Ed25519 (recommended)') }}
          </span>
        </label>
      </div>

      <details class="bw-ssh-generator__advanced">
        <summary>
          {{ t('nc_bitwarden', 'Advanced options') }}
        </summary>

        <div class="bw-ssh-generator__advanced-body">
          <label class="bw-ssh-generator__algorithm-option">
            <input
              v-model="algorithm"
              type="radio"
              value="rsa"
            >

            <span>RSA</span>
          </label>

          <label class="bw-ssh-generator__size">
            <span>{{ t('nc_bitwarden', 'RSA key size') }}</span>

            <select
              v-model.number="rsaBits"
              :disabled="algorithm !== 'rsa'"
            >
              <option :value="3072">3072</option>
              <option :value="4096">4096</option>
            </select>
          </label>
        </div>
      </details>

      <NcTextField
        v-model="comment"
        :label="t('nc_bitwarden', 'Comment (optional)')"
      />

      <NcButton
        variant="primary"
        :disabled="generating"
        @click="generate"
      >
        {{ generating
          ? t('nc_bitwarden', 'Generating key pair…')
          : t('nc_bitwarden', 'Generate key pair')
        }}
      </NcButton>

      <p
        v-if="status"
        class="bw-ssh-generator__status"
      >
        {{ status }}
      </p>

      <p
        v-if="generatorError"
        class="bw-ssh-generator__error"
      >
        {{ generatorError }}
      </p>
    </div>

    <div class="bw-ssh-generator__field">
      <div class="bw-ssh-generator__field-heading">
        <label class="bw-ssh-generator__label">
          {{ t('nc_bitwarden', 'Private key') }}
        </label>

        <button
          type="button"
          class="bw-ssh-generator__text-button"
          @click="privateKeyVisible = !privateKeyVisible"
        >
          {{ privateKeyVisible
            ? t('nc_bitwarden', 'Hide private key')
            : t('nc_bitwarden', 'Show private key')
          }}
        </button>
      </div>

      <textarea
        v-if="privateKeyVisible"
        v-model="privateKeyModel"
        class="bw-ssh-generator__textarea bw-ssh-generator__textarea--private"
        rows="10"
        spellcheck="false"
        autocomplete="off"
      />

      <button
        v-else
        type="button"
        class="bw-ssh-generator__masked"
        @click="privateKeyVisible = true"
      >
        <span aria-hidden="true">••••••••••••••••••••••••</span>
        <small>{{ t('nc_bitwarden', 'Private key hidden') }}</small>
      </button>
    </div>

    <div class="bw-ssh-generator__field">
      <div class="bw-ssh-generator__field-heading">
        <label class="bw-ssh-generator__label">
          {{ t('nc_bitwarden', 'Public key') }}
        </label>

        <button
          type="button"
          class="bw-ssh-generator__text-button"
          :disabled="!publicKeyModel.trim()"
          @click="copyPublicKey"
        >
          {{ t('nc_bitwarden', 'Copy public key') }}
        </button>
      </div>

      <textarea
        v-model="publicKeyModel"
        class="bw-ssh-generator__textarea"
        rows="4"
        spellcheck="false"
        autocomplete="off"
      />
    </div>

    <NcTextField
      v-model="fingerprintModel"
      :label="t('nc_bitwarden', 'Fingerprint')"
    />
  </section>
</template>

<script setup>
import {
  computed,
  ref,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { copySensitiveText } from '../services/clipboard.js'
import { generateSshKeyPair } from '../services/sshKeyGenerator.js'

const props = defineProps({
  privateKey: {
    type: String,
    default: '',
  },
  publicKey: {
    type: String,
    default: '',
  },
  fingerprint: {
    type: String,
    default: '',
  },
})

const emit = defineEmits([
  'update:privateKey',
  'update:publicKey',
  'update:fingerprint',
])

const algorithm = ref('ed25519')
const rsaBits = ref(3072)
const comment = ref('')
const generating = ref(false)
const generatorError = ref('')
const status = ref('')
const privateKeyVisible = ref(!props.privateKey)

const privateKeyModel = computed({
  get: () => props.privateKey,
  set: value => emit('update:privateKey', value),
})

const publicKeyModel = computed({
  get: () => props.publicKey,
  set: value => emit('update:publicKey', value),
})

const fingerprintModel = computed({
  get: () => props.fingerprint,
  set: value => emit('update:fingerprint', value),
})

const hasExistingKey = computed(() => Boolean(
  props.privateKey.trim()
  || props.publicKey.trim()
  || props.fingerprint.trim(),
))

async function generate() {
  if (
    hasExistingKey.value
    && !window.confirm(
      t(
        'nc_bitwarden',
        'Generating a new key pair replaces the existing SSH key fields. Continue?',
      ),
    )
  ) {
    return
  }

  generating.value = true
  generatorError.value = ''
  status.value = ''

  try {
    const generated = await generateSshKeyPair({
      algorithm: algorithm.value,
      rsaBits: rsaBits.value,
      comment: comment.value,
    })

    privateKeyModel.value = generated.privateKey
    publicKeyModel.value = generated.publicKey
    fingerprintModel.value = generated.fingerprint
    privateKeyVisible.value = false
    status.value = t(
      'nc_bitwarden',
      'SSH key pair generated.',
    )
  } catch (error) {
    console.error(
      '[nc_bitwarden] SSH key generation failed:',
      error,
    )

    generatorError.value = t(
      'nc_bitwarden',
      error?.message
        || 'The SSH key pair could not be generated.',
    )
  } finally {
    generating.value = false
  }
}

async function copyPublicKey() {
  if (!publicKeyModel.value.trim()) {
    return
  }

  status.value = ''
  generatorError.value = ''

  try {
    await copyText(publicKeyModel.value)
    status.value = t(
      'nc_bitwarden',
      'Public key copied.',
    )
  } catch (error) {
    console.error(
      '[nc_bitwarden] Public key copy failed:',
      error,
    )

    generatorError.value = t(
      'nc_bitwarden',
      'The public key could not be copied.',
    )
  }
}

async function copyText(value) {
  await copySensitiveText(value)
}
</script>

<style scoped>
.bw-ssh-generator {
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
  width: 100%;
  margin-bottom: 0.5rem;
}

.bw-ssh-generator__panel {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-ssh-generator__panel h3 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.3;
}

.bw-ssh-generator__hint,
.bw-ssh-generator__status,
.bw-ssh-generator__error {
  margin: 0;
}

.bw-ssh-generator__hint {
  color: var(--color-text-maxcontrast);
  line-height: 1.4;
}

.bw-ssh-generator__algorithm {
  display: flex;
  align-items: center;
  min-height: 32px;
}

.bw-ssh-generator__algorithm-option {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  padding: 0.2rem 0.35rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  line-height: 1.25;
}

.bw-ssh-generator__algorithm-option:hover {
  background: var(--color-background-hover);
}

.bw-ssh-generator__algorithm-option input[type="radio"] {
  width: 16px;
  height: 16px;
  flex: 0 0 16px;
  align-self: center;
  margin: 0;
  padding: 0;
  cursor: pointer;
}

.bw-ssh-generator__algorithm-option span {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  margin: 0;
  padding: 0;
  line-height: 1.25;
}

.bw-ssh-generator__advanced {
  margin: 0;
  padding: 0;
}

.bw-ssh-generator__advanced summary {
  width: fit-content;
  min-height: 30px;
  margin: 0;
  padding: 0.2rem 0.35rem;
  border-radius: var(--border-radius);
  cursor: pointer;
  font-weight: 600;
  line-height: 1.25;
}

.bw-ssh-generator__advanced summary:hover {
  background: var(--color-background-hover);
}

.bw-ssh-generator__advanced-body {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  margin-top: 0.25rem;
  padding-left: 0.1rem;
}

.bw-ssh-generator__size {
  display: inline-flex;
  min-height: 34px;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  line-height: 1.25;
}

.bw-ssh-generator__size > span {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
}

.bw-ssh-generator__size select {
  width: 76px;
  min-height: 34px;
  margin: 0;
  padding: 0.3rem 0.45rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-ssh-generator__size select:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.bw-ssh-generator__panel :deep(.input-field) {
  margin: 0;
}

.bw-ssh-generator__panel :deep(.input-field__main-wrapper) {
  margin: 0;
}

.bw-ssh-generator__panel :deep(.button-vue) {
  width: fit-content;
  min-height: 34px;
}

.bw-ssh-generator__status {
  color: var(--color-success-text);
  font-weight: 600;
}

.bw-ssh-generator__error {
  color: var(--color-error);
}

.bw-ssh-generator__field {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.bw-ssh-generator__field-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bw-ssh-generator__label {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.bw-ssh-generator__text-button {
  padding: 0.2rem 0.45rem;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-primary-element);
  cursor: pointer;
  font-weight: 600;
}

.bw-ssh-generator__text-button:hover:not(:disabled),
.bw-ssh-generator__text-button:focus-visible:not(:disabled) {
  background: var(--color-background-hover);
}

.bw-ssh-generator__text-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.bw-ssh-generator__textarea,
.bw-ssh-generator__masked {
  width: 100%;
  box-sizing: border-box;
  padding: 0.55rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  font-family: monospace;
}

.bw-ssh-generator__textarea {
  resize: vertical;
  white-space: pre;
}

.bw-ssh-generator__textarea--private {
  min-height: 9rem;
}

.bw-ssh-generator__masked {
  display: flex;
  min-height: 4.25rem;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.25rem;
  cursor: pointer;
  text-align: left;
}

.bw-ssh-generator__masked span {
  letter-spacing: 0.15em;
}

.bw-ssh-generator__masked small {
  color: var(--color-text-maxcontrast);
  font-family: inherit;
}

@media (max-width: 700px) {
  .bw-ssh-generator__advanced-body,
  .bw-ssh-generator__field-heading {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
