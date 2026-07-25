<template>
  <section class="bw-totp">
    <div class="bw-totp__heading">
      <span>
        {{ t(
          'nc_bitwarden',
          'One-time passwords',
        ) }}
      </span>

      <span
        v-if="!error"
        class="bw-totp__countdown"
      >
        {{ t(
          'nc_bitwarden',
          'Switches in {seconds} s',
          { seconds: secondsRemaining },
        ) }}
      </span>
    </div>

    <p
      v-if="error"
      class="bw-totp__error"
    >
      {{ error }}
    </p>

    <template v-else>
      <div class="bw-totp__codes">
        <article class="bw-totp__code-card">
          <div class="bw-totp__code-label">
            {{ t(
              'nc_bitwarden',
              'Current code',
            ) }}
          </div>

          <div class="bw-totp__code-row">
            <div
              class="bw-totp__code"
              aria-live="polite"
            >
              {{ formattedCurrentCode }}
            </div>

            <button
              type="button"
              class="bw-totp__copy"
              :class="{
                'bw-totp__copy--copied':
                  copiedType === 'current',
              }"
              :disabled="!currentCode"
              :title="t(
                'nc_bitwarden',
                'Copy current code',
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Copy current code',
              )"
              @click="
                copyCode(
                  currentCode,
                  'current',
                )
              "
            >
              <span
                v-if="copiedType === 'current'"
                class="bw-totp__check"
                aria-hidden="true"
              >✓</span>

              <ContentCopyIcon
                v-else
                :size="18"
              />
            </button>
          </div>
        </article>

        <article
          class="
            bw-totp__code-card
            bw-totp__code-card--next
          "
        >
          <div class="bw-totp__code-label">
            {{ t(
              'nc_bitwarden',
              'Next code',
            ) }}
          </div>

          <div class="bw-totp__code-row">
            <div
              class="bw-totp__code"
              aria-live="polite"
            >
              {{ formattedNextCode }}
            </div>

            <button
              type="button"
              class="bw-totp__copy"
              :class="{
                'bw-totp__copy--copied':
                  copiedType === 'next',
              }"
              :disabled="!nextCode"
              :title="t(
                'nc_bitwarden',
                'Copy next code',
              )"
              :aria-label="t(
                'nc_bitwarden',
                'Copy next code',
              )"
              @click="
                copyCode(
                  nextCode,
                  'next',
                )
              "
            >
              <span
                v-if="copiedType === 'next'"
                class="bw-totp__check"
                aria-hidden="true"
              >✓</span>

              <ContentCopyIcon
                v-else
                :size="18"
              />
            </button>
          </div>
        </article>
      </div>

      <div class="bw-totp__progress">
        <div
          class="bw-totp__progress-value"
          :style="{
            width: `${progressPercent}%`,
          }"
        />
      </div>

      <p
        v-if="copyError"
        class="bw-totp__error"
        aria-live="polite"
      >
        {{ copyError }}
      </p>
    </template>
  </section>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import { copySensitiveText } from '../services/clipboard.js'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import { generateTotpPair } from '../utils/totp.js'

const props = defineProps({
  secret: {
    type: String,
    required: true,
  },
})

const currentCode = ref('')
const nextCode = ref('')
const period = ref(30)
const expiresAt = ref(0)
const secondsRemaining = ref(0)
const error = ref('')
const copiedType = ref('')
const copyError = ref('')

let timer = null
let copyMessageTimer = null
let refreshing = false
let refreshPending = false
let requestRevision = 0

const formattedCurrentCode = computed(() =>
  formatCode(currentCode.value),
)

const formattedNextCode = computed(() =>
  formatCode(nextCode.value),
)

const progressPercent = computed(() => {
  if (!period.value) {
    return 0
  }

  return Math.max(
    0,
    Math.min(
      100,
      (secondsRemaining.value / period.value) * 100,
    ),
  )
})

function formatCode(value) {
  if (!value) {
    return '– – –'
  }

  return String(value)
    .match(/.{1,3}/g)
    ?.join(' ') ?? value
}

function updateCountdown() {
  if (!expiresAt.value) {
    return
  }

  secondsRemaining.value = Math.max(
    0,
    Math.ceil(
      (expiresAt.value - Date.now()) / 1000,
    ),
  )

  if (secondsRemaining.value === 0) {
    refreshCodes()
  }
}

async function refreshCodes() {
  if (refreshing) {
    refreshPending = true
    return
  }

  refreshing = true
  const revision = ++requestRevision

  try {
    const result = await generateTotpPair(
      props.secret,
      Date.now(),
    )

    if (revision !== requestRevision) {
      return
    }

    currentCode.value = result.currentCode
    nextCode.value = result.nextCode
    period.value = result.period
    expiresAt.value = result.expiresAt
    error.value = ''

    updateCountdown()
  } catch (exception) {
    if (revision !== requestRevision) {
      return
    }

    currentCode.value = ''
    nextCode.value = ''
    expiresAt.value = 0
    secondsRemaining.value = 0
    error.value =
      exception instanceof Error
        ? exception.message
        : t(
          'nc_bitwarden',
          'The TOTP code could not be generated.',
        )
  } finally {
    refreshing = false

    if (refreshPending) {
      refreshPending = false
      refreshCodes()
    }
  }
}

async function writeClipboard(value) {
  try {
    return await copySensitiveText(value)
  } catch {
    return false
  }
}

async function copyCode(value, type) {
  if (!value) {
    return
  }

  const copied = await writeClipboard(value)

  copiedType.value = copied
    ? type
    : ''

  copyError.value = copied
    ? ''
    : t(
      'nc_bitwarden',
      'The code could not be copied.',
    )

  if (copyMessageTimer) {
    clearTimeout(copyMessageTimer)
  }

  copyMessageTimer = setTimeout(() => {
    copiedType.value = ''
    copyError.value = ''
  }, 1600)
}

watch(
  () => props.secret,
  () => {
    requestRevision += 1
    currentCode.value = ''
    nextCode.value = ''
    error.value = ''
    copiedType.value = ''
    copyError.value = ''
    refreshCodes()
  },
  {
    immediate: true,
  },
)

onMounted(() => {
  timer = setInterval(updateCountdown, 250)
})

onBeforeUnmount(() => {
  requestRevision += 1

  if (timer) {
    clearInterval(timer)
  }

  if (copyMessageTimer) {
    clearTimeout(copyMessageTimer)
  }
})
</script>

<style scoped>

.bw-totp {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.6rem;
  overflow: hidden;
  margin: 0.7rem 1rem;
  padding: 0.85rem;
  border: 0;
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-totp__heading {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.4rem 1rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.9rem;
  font-weight: 650;
}

.bw-totp__countdown {
  font-size: 0.78rem;
  font-weight: normal;
}

.bw-totp__codes {
  display: grid;
  min-width: 0;
  grid-template-columns:
    minmax(0, 2fr)
    minmax(190px, 1fr);
  gap: 0.65rem;
}

.bw-totp__code-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.75rem;
  border: 0;
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-totp__code-card--next {
  opacity: 0.82;
}

.bw-totp__code-label {
  color: var(--color-text-maxcontrast);
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.bw-totp__code-row {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.bw-totp__code {
  min-width: 0;
  overflow: hidden;
  font-family: var(--font-face-monospace);
  font-size: clamp(1.7rem, 3vw, 2.15rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-totp__code-card--next
  .bw-totp__code {
  font-size: clamp(1.3rem, 2.2vw, 1.7rem);
}

.bw-totp__copy {
  display: inline-flex;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-totp__copy:hover:not(:disabled),
.bw-totp__copy:focus-visible:not(:disabled) {
  border-color: var(--color-border);
  background: var(--color-background-hover);
  color: var(--color-primary-element);
}

.bw-totp__copy:disabled {
  cursor: default;
  opacity: 0.45;
}

.bw-totp__copy--copied,
.bw-totp__check {
  color: var(--color-success);
}

.bw-totp__check {
  font-size: 1.05rem;
  font-weight: 700;
}

.bw-totp__progress {
  height: 4px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--color-border);
}

.bw-totp__progress-value {
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary-element);
  transition: width 0.25s linear;
}

.bw-totp__error {
  margin: 0;
  color: var(--color-error);
  font-size: 0.82rem;
}

@media (max-width: 700px) {
  .bw-totp {
    margin-right: 0.5rem;
    margin-left: 0.5rem;
  }

  .bw-totp__codes {
    grid-template-columns: 1fr;
  }
}
</style>
