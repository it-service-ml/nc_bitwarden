<template>
  <div class="bw-password-generator">
    <div class="bw-password-generator__actions">
      <button
        type="button"
        class="bw-password-generator__button"
        @click="expanded = !expanded"
      >
        {{ expanded
          ? t('nc_bitwarden', 'Close generator')
          : t('nc_bitwarden', 'Generate password')
        }}
      </button>

      <button
        type="button"
        class="bw-password-generator__button"
        :disabled="!modelValue"
        @click="copyPassword"
      >
        {{ t('nc_bitwarden', 'Copy') }}
      </button>
    </div>

    <div
      v-if="expanded"
      class="bw-password-generator__panel"
    >
      <div class="bw-password-generator__length-section">
        <label class="bw-password-generator__length">
          <span>{{ t('nc_bitwarden', 'Length') }}</span>

          <input
            v-model.number="length"
            type="number"
            min="8"
            max="128"
            step="1"
          >
        </label>

        <div class="bw-password-generator__presets">
          <button
            v-for="preset in LENGTH_PRESETS"
            :key="preset"
            type="button"
            class="bw-password-generator__preset"
            :class="{
              'bw-password-generator__preset--active':
                length === preset,
            }"
            @click="length = preset"
          >
            {{ preset }}
          </button>
        </div>
      </div>

      <div class="bw-password-generator__options">
        <label>
          <input
            v-model="useLowercase"
            type="checkbox"
          >
          {{ t('nc_bitwarden', 'Lowercase letters') }}
        </label>

        <label>
          <input
            v-model="useUppercase"
            type="checkbox"
          >
          {{ t('nc_bitwarden', 'Uppercase letters') }}
        </label>

        <label>
          <input
            v-model="useDigits"
            type="checkbox"
          >
          {{ t('nc_bitwarden', 'Numbers') }}
        </label>

        <label>
          <input
            v-model="useSymbols"
            type="checkbox"
          >
          {{ t('nc_bitwarden', 'Special characters') }}
        </label>

        <label>
          <input
            v-model="excludeAmbiguous"
            type="checkbox"
          >
          {{ t(
            'nc_bitwarden',
            'Exclude ambiguous characters',
          ) }}
        </label>
      </div>

      <button
        type="button"
        class="bw-password-generator__generate"
        @click="generatePassword"
      >
        {{ t('nc_bitwarden', 'Generate new password') }}
      </button>

      <p
        v-if="message"
        class="bw-password-generator__message"
      >
        {{ message }}
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { t } from '@nextcloud/l10n'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  initiallyExpanded: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits([
  'update:modelValue',
])

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/|'
const AMBIGUOUS = new Set('Il1O0o')
const LENGTH_PRESETS = [8, 16, 24, 32, 64]

const expanded = ref(props.initiallyExpanded)
const length = ref(24)
const useLowercase = ref(true)
const useUppercase = ref(true)
const useDigits = ref(true)
const useSymbols = ref(true)
const excludeAmbiguous = ref(true)
const message = ref('')

function cleanCharacterSet(value) {
  if (!excludeAmbiguous.value) {
    return value
  }

  return [...value]
    .filter(character => !AMBIGUOUS.has(character))
    .join('')
}

function secureIndex(maximum) {
  if (!Number.isInteger(maximum) || maximum < 1) {
    throw new Error(
      t('nc_bitwarden', 'Invalid character selection.'),
    )
  }

  const range = 0x100000000
  const limit = Math.floor(range / maximum) * maximum
  const buffer = new Uint32Array(1)

  do {
    crypto.getRandomValues(buffer)
  } while (buffer[0] >= limit)

  return buffer[0] % maximum
}

function randomCharacter(characterSet) {
  return characterSet[secureIndex(characterSet.length)]
}

function secureShuffle(values) {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1)

    ;[values[index], values[swapIndex]] = [
      values[swapIndex],
      values[index],
    ]
  }

  return values
}

function generatePassword() {
  message.value = ''

  const characterSets = []

  if (useLowercase.value) {
    characterSets.push(cleanCharacterSet(LOWERCASE))
  }

  if (useUppercase.value) {
    characterSets.push(cleanCharacterSet(UPPERCASE))
  }

  if (useDigits.value) {
    characterSets.push(cleanCharacterSet(DIGITS))
  }

  if (useSymbols.value) {
    characterSets.push(cleanCharacterSet(SYMBOLS))
  }

  if (characterSets.length === 0) {
    message.value = t(
      'nc_bitwarden',
      'Select at least one character group.',
    )
    return
  }

  const requestedLength = Math.max(
    8,
    Math.min(128, Number(length.value) || 20),
  )

  length.value = requestedLength

  const effectiveLength = Math.max(
    requestedLength,
    characterSets.length,
  )

  const passwordCharacters = characterSets.map(
    characterSet => randomCharacter(characterSet),
  )

  const completeCharacterSet = characterSets.join('')

  while (passwordCharacters.length < effectiveLength) {
    passwordCharacters.push(
      randomCharacter(completeCharacterSet),
    )
  }

  const password = secureShuffle(passwordCharacters).join('')

  emit('update:modelValue', password)
  message.value = t(
    'nc_bitwarden',
    'Password with {length} characters generated.',
    { length: password.length },
  )
}

async function copyPassword() {
  if (!props.modelValue) {
    return
  }

  message.value = ''

  try {
    await navigator.clipboard.writeText(props.modelValue)
    message.value = t('nc_bitwarden', 'Password was copied.')

  } catch {
    const textarea = document.createElement('textarea')

    textarea.value = props.modelValue
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.select()

    const copied = document.execCommand('copy')
    textarea.remove()

    message.value = copied
      ? t('nc_bitwarden', 'Password was copied.')
      : t(
        'nc_bitwarden',
        'Password could not be copied.',
      )
  }
}
</script>

<style scoped>
.bw-password-generator {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: -0.35rem;
  margin-bottom: 0.8rem;
}

.bw-password-generator__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bw-password-generator__button,
.bw-password-generator__generate {
  min-height: 34px;
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-password-generator__button:hover,
.bw-password-generator__button:focus-visible,
.bw-password-generator__generate:hover,
.bw-password-generator__generate:focus-visible {
  background: var(--color-background-hover);
}

.bw-password-generator__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.bw-password-generator__panel {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-password-generator__length-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bw-password-generator__length {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bw-password-generator__length input {
  width: 90px;
}

.bw-password-generator__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.bw-password-generator__preset {
  min-width: 44px;
  min-height: 32px;
  padding: 0.3rem 0.6rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-password-generator__preset:hover,
.bw-password-generator__preset:focus-visible {
  background: var(--color-background-hover);
}

.bw-password-generator__preset--active {
  border-color: var(--color-primary-element);
  background: var(--color-primary-element-light);
  color: var(--color-primary-element-text);
}

.bw-password-generator__options {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(190px, 1fr)
  );
  gap: 0.5rem 1rem;
}

.bw-password-generator__options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bw-password-generator__generate {
  align-self: flex-start;
  background: var(--color-primary-element);
  color: var(--color-primary-element-text);
}

.bw-password-generator__message {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
}
</style>
