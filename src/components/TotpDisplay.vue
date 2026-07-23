<template>
  <section class="bw-totp">
    <div class="bw-totp__heading">
      <span>Einmalpasswörter</span>

      <span
        v-if="!error"
        class="bw-totp__countdown"
      >
        Wechsel in {{ secondsRemaining }} s
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
            Aktueller Code
          </div>

          <div
            class="bw-totp__code"
            aria-live="polite"
          >
            {{ formattedCurrentCode }}
          </div>

          <NcButton
            :disabled="!currentCode"
            @click="copyCode(currentCode, 'current')"
          >
            Aktuellen Code kopieren
          </NcButton>
        </article>

        <article
          class="
            bw-totp__code-card
            bw-totp__code-card--next
          "
        >
          <div class="bw-totp__code-label">
            Nächster Code
          </div>

          <div
            class="bw-totp__code"
            aria-live="polite"
          >
            {{ formattedNextCode }}
          </div>

          <NcButton
            :disabled="!nextCode"
            @click="copyCode(nextCode, 'next')"
          >
            Nächsten Code kopieren
          </NcButton>
        </article>
      </div>

      <div class="bw-totp__progress">
        <div
          class="bw-totp__progress-value"
          :style="{ width: `${progressPercent}%` }"
        />
      </div>

      <p
        v-if="copyMessage"
        class="bw-totp__message"
        aria-live="polite"
      >
        {{ copyMessage }}
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
import NcButton from '@nextcloud/vue/components/NcButton'
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
const copyMessage = ref('')

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
        : 'Der TOTP-Code konnte nicht erzeugt werden.'
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
    await navigator.clipboard.writeText(value)
    return true
  } catch {
    const textarea = document.createElement('textarea')

    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'

    document.body.appendChild(textarea)
    textarea.select()

    const copied = document.execCommand('copy')
    textarea.remove()

    return copied
  }
}

async function copyCode(value, type) {
  if (!value) {
    return
  }

  const copied = await writeClipboard(value)

  copyMessage.value = copied
    ? type === 'current'
      ? 'Aktueller Code wurde kopiert.'
      : 'Nächster Code wurde kopiert.'
    : 'Der Code konnte nicht kopiert werden.'

  if (copyMessageTimer) {
    clearTimeout(copyMessageTimer)
  }

  copyMessageTimer = setTimeout(() => {
    copyMessage.value = ''
  }, 2500)
}

watch(
  () => props.secret,
  () => {
    requestRevision += 1
    currentCode.value = ''
    nextCode.value = ''
    error.value = ''
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
  flex-direction: column;
  gap: 0.75rem;
  margin: 0.75rem 1rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-totp__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-weight: 600;
}

.bw-totp__countdown {
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
  font-weight: normal;
}

.bw-totp__codes {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(220px, 1fr)
  );
  gap: 0.75rem;
}

.bw-totp__code-card {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-totp__code-card--next {
  opacity: 0.78;
}

.bw-totp__code-label {
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
}

.bw-totp__code {
  font-family: var(--font-face-monospace);
  font-size: clamp(1.6rem, 4vw, 2.35rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  white-space: nowrap;
}

.bw-totp__progress {
  height: 5px;
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

.bw-totp__message,
.bw-totp__error {
  margin: 0;
}

.bw-totp__message {
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
}

.bw-totp__error {
  color: var(--color-error);
}
</style>
