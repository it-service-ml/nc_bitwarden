<template>
  <div class="bw-password-generator">
    <div class="bw-password-generator__actions">
      <button
        v-if="showToggle"
        type="button"
        class="bw-password-generator__button"
        @click="expanded = !expanded"
      >
        {{
          expanded
            ? t('nc_bitwarden', 'Close generator')
            : t('nc_bitwarden', 'Generate password')
        }}
      </button>

      <button
        type="button"
        class="bw-password-generator__button"
        :disabled="!modelValue"
        @click="copyGeneratedValue"
      >
        {{ t('nc_bitwarden', 'Copy') }}
      </button>
    </div>

    <div
      v-if="expanded"
      class="bw-password-generator__panel"
    >
      <div class="bw-password-generator__mode">
        <label>
          <input
            v-model="mode"
            type="radio"
            value="password"
          >
          {{ t('nc_bitwarden', 'Password') }}
        </label>

        <label>
          <input
            v-model="mode"
            type="radio"
            value="passphrase"
          >
          {{ t('nc_bitwarden', 'Passphrase') }}
        </label>
      </div>

      <template v-if="mode === 'password'">
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
            {{
              t(
                'nc_bitwarden',
                'Exclude ambiguous characters',
              )
            }}
          </label>
        </div>
      </template>

      <template v-else>
        <div class="bw-password-generator__passphrase-grid">
          <label>
            <span>{{ t('nc_bitwarden', 'Word list language') }}</span>
            <select v-model="passphraseLanguage">
              <option value="de">
                {{ t('nc_bitwarden', 'German') }}
              </option>
              <option value="en">
                {{ t('nc_bitwarden', 'English') }}
              </option>
            </select>
          </label>

          <label>
            <span>{{ t('nc_bitwarden', 'Word count') }}</span>
            <input
              v-model.number="wordCount"
              type="number"
              min="4"
              max="8"
              step="1"
            >
          </label>

          <label>
            <span>{{ t('nc_bitwarden', 'Separator') }}</span>
            <select v-model="separator">
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
          </label>

          <label>
            <span>{{ t('nc_bitwarden', 'Capitalization') }}</span>
            <select v-model="capitalization">
              <option value="lower">
                {{ t('nc_bitwarden', 'Lowercase') }}
              </option>
              <option value="first">
                {{ t('nc_bitwarden', 'First word capitalized') }}
              </option>
              <option value="all">
                {{ t('nc_bitwarden', 'Every word capitalized') }}
              </option>
            </select>
          </label>
        </div>

        <div class="bw-password-generator__options">
          <label>
            <input
              v-model="includeNumber"
              type="checkbox"
            >
            {{ t('nc_bitwarden', 'Add random number') }}
          </label>

          <label>
            <input
              v-model="includeSymbol"
              type="checkbox"
            >
            {{
              t(
                'nc_bitwarden',
                'Add random special character',
              )
            }}
          </label>
        </div>
      </template>

      <button
        type="button"
        class="bw-password-generator__generate"
        @click="generate"
      >
        {{
          mode === 'passphrase'
            ? t('nc_bitwarden', 'Generate new passphrase')
            : t('nc_bitwarden', 'Generate new password')
        }}
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
import {
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import { copySensitiveText } from '../services/clipboard.js'
import { normalizeUserPreferences } from '../services/userPreferences.js'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  initiallyExpanded: {
    type: Boolean,
    default: false,
  },
  showToggle: {
    type: Boolean,
    default: true,
  },
  preferences: {
    type: Object,
    default: () => ({}),
  },
})

const emit = defineEmits([
  'update:modelValue',
])

const LOWERCASE = 'abcdefghijklmnopqrstuvwxyz'
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const DIGITS = '0123456789'
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.?/|'
const PASSPHRASE_SYMBOLS = '!@#$%&*?'
const AMBIGUOUS = new Set('Il1O0o')
const LENGTH_PRESETS = [8, 16, 24, 32, 64]

const PASSPHRASE_PREFIXES = [
  'amber',
  'ancient',
  'autumn',
  'bright',
  'brisk',
  'calm',
  'clear',
  'cloudy',
  'cool',
  'coral',
  'crimson',
  'crystal',
  'daring',
  'deep',
  'eager',
  'early',
  'electric',
  'emerald',
  'faint',
  'frozen',
  'gentle',
  'golden',
  'grand',
  'green',
  'happy',
  'hidden',
  'icy',
  'indigo',
  'jolly',
  'keen',
  'light',
  'lively',
  'lucky',
  'lunar',
  'misty',
  'modern',
  'noble',
  'ocean',
  'orange',
  'quiet',
  'rapid',
  'red',
  'royal',
  'silver',
  'silent',
  'solar',
  'steady',
  'stone',
  'sunny',
  'swift',
  'tender',
  'tidy',
  'tiny',
  'urban',
  'velvet',
  'violet',
  'warm',
  'wild',
  'wise',
  'wooden',
  'young',
  'zealous',
  'blue',
  'soft',
]

const PASSPHRASE_SUFFIXES = [
  'anchor',
  'apple',
  'badger',
  'beacon',
  'birch',
  'breeze',
  'bridge',
  'cabin',
  'canyon',
  'cedar',
  'comet',
  'coral',
  'crane',
  'creek',
  'dawn',
  'delta',
  'eagle',
  'ember',
  'falcon',
  'fern',
  'field',
  'forest',
  'fox',
  'garden',
  'glacier',
  'harbor',
  'hawk',
  'hill',
  'island',
  'jungle',
  'lake',
  'lantern',
  'leaf',
  'meadow',
  'moon',
  'mountain',
  'oak',
  'oasis',
  'otter',
  'owl',
  'pebble',
  'pine',
  'planet',
  'plum',
  'pond',
  'quartz',
  'raven',
  'reef',
  'river',
  'robin',
  'rock',
  'rose',
  'shadow',
  'shore',
  'sky',
  'sparrow',
  'star',
  'storm',
  'summit',
  'sun',
  'tiger',
  'valley',
  'willow',
  'wolf',
]

const GERMAN_PASSPHRASE_PREFIXES = [
  'achtsam', 'aktiv', 'blau', 'breit', 'bunt', 'dunkel', 'echt', 'eilig',
  'fein', 'fest', 'frisch', 'froh', 'gelb', 'glatt', 'golden', 'gross',
  'gruen', 'hell', 'heiter', 'klar', 'klug', 'kuehl', 'kurz', 'leise',
  'leicht', 'lustig', 'mild', 'modern', 'mutig', 'nah', 'neu', 'nobel',
  'offen', 'orange', 'rasch', 'ruhig', 'rund', 'sanft', 'sauber', 'scharf',
  'schlau', 'schnell', 'schwarz', 'silbern', 'sicher', 'sonnig', 'stark',
  'still', 'stolz', 'tief', 'treu', 'trocken', 'urban', 'violett', 'wach',
  'warm', 'weich', 'weise', 'weit', 'weiss', 'wild', 'zart', 'zeitlos',
]

const GERMAN_PASSPHRASE_SUFFIXES = [
  'adler', 'anker', 'apfel', 'bach', 'berg', 'birke', 'blitz', 'bruecke',
  'burg', 'dachs', 'delta', 'eiche', 'falke', 'feld', 'felsen', 'fichte',
  'fluss', 'fuchs', 'garten', 'gipfel', 'hafen', 'hain', 'hase', 'himmel',
  'insel', 'kiefer', 'kiesel', 'komet', 'kranich', 'kristall', 'laterne',
  'licht', 'luchs', 'meer', 'mond', 'moos', 'nebel', 'oase', 'otter',
  'pfad', 'planet', 'quelle', 'rabe', 'regen', 'riff', 'rose', 'schatten',
  'see', 'sonne', 'spatz', 'stern', 'stein', 'strand', 'sturm', 'tal',
  'tanne', 'tiger', 'ufer', 'wald', 'welle', 'wiese', 'wolf', 'zeder',
]

const expanded = ref(props.initiallyExpanded)
const mode = ref('password')
const length = ref(24)
const useLowercase = ref(true)
const useUppercase = ref(true)
const useDigits = ref(true)
const useSymbols = ref(true)
const excludeAmbiguous = ref(true)
const passphraseLanguage = ref('de')
const wordCount = ref(5)
const separator = ref('hyphen')
const capitalization = ref('first')
const includeNumber = ref(true)
const includeSymbol = ref(false)
const message = ref('')

function applyPreferences(value) {
  const preferences = normalizeUserPreferences(value)

  mode.value = preferences.generator_mode
  length.value = preferences.password_length
  useLowercase.value = preferences.password_use_lowercase
  useUppercase.value = preferences.password_use_uppercase
  useDigits.value = preferences.password_use_digits
  useSymbols.value = preferences.password_use_symbols
  excludeAmbiguous.value = preferences.password_exclude_ambiguous
  passphraseLanguage.value = preferences.passphrase_language
  wordCount.value = preferences.passphrase_word_count
  separator.value = preferences.passphrase_separator
  capitalization.value = preferences.passphrase_capitalization
  includeNumber.value = preferences.passphrase_include_number
  includeSymbol.value = preferences.passphrase_include_symbol
}

watch(
  () => props.preferences,
  applyPreferences,
  {
    deep: true,
    immediate: true,
  },
)

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
  for (
    let index = values.length - 1;
    index > 0;
    index -= 1
  ) {
    const swapIndex = secureIndex(index + 1)

    ;[values[index], values[swapIndex]] = [
      values[swapIndex],
      values[index],
    ]
  }

  return values
}

function generatePassword() {
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
    Math.min(128, Number(length.value) || 24),
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

function separatorCharacter() {
  return {
    hyphen: '-',
    space: ' ',
    dot: '.',
    underscore: '_',
  }[separator.value] ?? '-'
}

function capitalizeWord(word) {
  return word
    ? word.charAt(0).toLocaleUpperCase('de')
      + word.slice(1)
    : word
}

function generatePassphrase() {
  const effectiveWordCount = Math.max(
    4,
    Math.min(8, Number(wordCount.value) || 5),
  )

  wordCount.value = effectiveWordCount

  const prefixWords = passphraseLanguage.value === 'de'
    ? GERMAN_PASSPHRASE_PREFIXES
    : PASSPHRASE_PREFIXES
  const suffixWords = passphraseLanguage.value === 'de'
    ? GERMAN_PASSPHRASE_SUFFIXES
    : PASSPHRASE_SUFFIXES

  const words = Array.from(
    { length: effectiveWordCount },
    () => (
      prefixWords[secureIndex(prefixWords.length)]
      + suffixWords[secureIndex(suffixWords.length)]
    ),
  )

  if (capitalization.value === 'first') {
    words[0] = capitalizeWord(words[0])
  } else if (capitalization.value === 'all') {
    for (let index = 0; index < words.length; index += 1) {
      words[index] = capitalizeWord(words[index])
    }
  }

  let passphrase = words.join(separatorCharacter())

  if (includeNumber.value) {
    const number = String(secureIndex(100)).padStart(2, '0')
    passphrase += `${separatorCharacter()}${number}`
  }

  if (includeSymbol.value) {
    passphrase += randomCharacter(PASSPHRASE_SYMBOLS)
  }

  emit('update:modelValue', passphrase)
  message.value = t(
    'nc_bitwarden',
    'Passphrase with {count} word blocks generated.',
    { count: effectiveWordCount },
  )
}

function generate() {
  message.value = ''

  if (mode.value === 'passphrase') {
    generatePassphrase()
    return
  }

  generatePassword()
}

async function copyGeneratedValue() {
  if (!props.modelValue) {
    return
  }

  message.value = ''

  try {
    await copySensitiveText(props.modelValue)
    message.value = t('nc_bitwarden', 'Password was copied.')
  } catch {
    message.value = t(
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

.bw-password-generator__actions,
.bw-password-generator__mode,
.bw-password-generator__presets {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.bw-password-generator__mode label,
.bw-password-generator__options label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bw-password-generator__button,
.bw-password-generator__generate,
.bw-password-generator__preset {
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
.bw-password-generator__generate:focus-visible,
.bw-password-generator__preset:hover,
.bw-password-generator__preset:focus-visible {
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

.bw-password-generator__preset {
  min-width: 44px;
  min-height: 32px;
  padding: 0.3rem 0.6rem;
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

.bw-password-generator__passphrase-grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(170px, 1fr)
  );
  gap: 0.75rem;
}

.bw-password-generator__passphrase-grid label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.bw-password-generator__passphrase-grid input,
.bw-password-generator__passphrase-grid select {
  min-height: 34px;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
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
