<template>
  <article
    class="bw-field-card"
    :class="{
      'bw-field-card--wide': wide,
      'bw-field-card--secret': secret,
      'bw-field-card--compact': compact,
      'bw-field-card--collapsible': collapsible,
    }"
  >
    <header class="bw-field-card__header">
      <span class="bw-field-card__label">
        {{ label }}
      </span>

      <div class="bw-field-card__actions">
        <button
          v-if="secret && !revealBlocked && hasValue"
          type="button"
          class="bw-field-card__action"
          :title="revealed
            ? t('nc_bitwarden', 'Hide value')
            : t('nc_bitwarden', 'Show value')"
          :aria-label="revealed
            ? t('nc_bitwarden', 'Hide value')
            : t('nc_bitwarden', 'Show value')"
          @click="revealed = !revealed"
        >
          <EyeOffOutlineIcon
            v-if="revealed"
            :size="18"
          />

          <EyeOutlineIcon
            v-else
            :size="18"
          />
        </button>

        <a
          v-if="normalizedHref"
          class="bw-field-card__action"
          :href="normalizedHref"
          target="_blank"
          rel="noopener noreferrer"
          :title="t('nc_bitwarden', 'Open in new tab')"
          :aria-label="t('nc_bitwarden', 'Open in new tab')"
        >
          <OpenInNewIcon :size="18" />
        </a>

        <button
          v-if="copyable && hasValue"
          type="button"
          class="bw-field-card__action"
          :class="{
            'bw-field-card__action--copied': copied,
          }"
          :title="t('nc_bitwarden', 'Copy to clipboard')"
          :aria-label="t('nc_bitwarden', 'Copy to clipboard')"
          @click="copyValue"
        >
          <span
            v-if="copied"
            class="bw-field-card__check"
            aria-hidden="true"
          >✓</span>
          <ContentCopyIcon
            v-else
            :size="18"
          />
        </button>
      </div>
    </header>

    <div
      class="bw-field-card__value"
      :class="{
        'bw-field-card__value--secret': secret,
        'bw-field-card__value--empty': !hasValue,
      }"
    >
      <a
        v-if="normalizedHref && hasValue"
        :href="normalizedHref"
        target="_blank"
        rel="noopener noreferrer"
      >
        {{ displayValue }}
      </a>

      <span v-else>
        {{ displayValue }}
      </span>
    </div>

    <button
      v-if="hasCollapsibleContent"
      type="button"
      class="bw-field-card__toggle"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      {{ expanded
        ? t('nc_bitwarden', 'Hide full URL')
        : t('nc_bitwarden', 'Show full URL')
      }}
    </button>

    <p
      v-if="hint"
      class="bw-field-card__hint"
    >
      {{ hint }}
    </p>

    <p
      v-if="message"
      class="bw-field-card__message"
      aria-live="polite"
    >
      {{ message }}
    </p>
  </article>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue'
import { t } from '@nextcloud/l10n'
import { copySensitiveText } from '../services/clipboard.js'
import EyeOutlineIcon from 'vue-material-design-icons/EyeOutline.vue'
import EyeOffOutlineIcon from 'vue-material-design-icons/EyeOffOutline.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import OpenInNewIcon from 'vue-material-design-icons/OpenInNew.vue'

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  value: {
    type: [
      String,
      Number,
    ],
    default: '',
  },
  copyable: {
    type: Boolean,
    default: false,
  },
  secret: {
    type: Boolean,
    default: false,
  },

  /*
   * Stufe 2O-3a/2O-3b1:
   * Ein Geheimwert kann dauerhaft maskiert werden.
   *
   * Die negative Property erlaubt den Vue-konformen
   * Boolean-Standardwert false.
   */
  revealBlocked: {
    type: Boolean,
    default: false,
  },

  href: {
    type: String,
    default: '',
  },
  wide: {
    type: Boolean,
    default: false,
  },
  hint: {
    type: String,
    default: '',
  },
  compact: {
    type: Boolean,
    default: false,
  },
  collapsible: {
    type: Boolean,
    default: false,
  },
})

const revealed = ref(false)
const copied = ref(false)
const expanded = ref(false)
const message = ref('')

let messageTimer = null

const rawValue = computed(() =>
  props.value === null || props.value === undefined
    ? ''
    : String(props.value),
)

const hasValue = computed(() =>
  rawValue.value.trim().length > 0,
)

const normalizedHref = computed(() => {
  const value = String(
    props.href || '',
  ).trim()

  if (!value) {
    return ''
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return value
  }

  return `https://${value}`
})

const hasCollapsibleContent = computed(() =>
  props.collapsible
  && Boolean(normalizedHref.value)
  && rawValue.value.length > 80,
)

const collapsedValue = computed(() => {
  try {
    const url = new URL(
      normalizedHref.value,
    )

    const path = url.pathname === '/'
      ? ''
      : url.pathname

    const preview = (
      `${url.hostname}${path}`
    )

    return preview.length > 72
      ? `${preview.slice(0, 72)}…`
      : preview
  } catch {
    return rawValue.value.length > 72
      ? `${rawValue.value.slice(0, 72)}…`
      : rawValue.value
  }
})

const displayValue = computed(() => {
  if (!hasValue.value) {
    return t('nc_bitwarden', 'Not provided')
  }

  if (
    props.secret
    && (
      props.revealBlocked
      || !revealed.value
    )
  ) {
    return '••••••••••••'
  }

  if (
    hasCollapsibleContent.value
    && !expanded.value
  ) {
    return collapsedValue.value
  }

  return rawValue.value
})

function clearMessageTimer() {
  if (messageTimer) {
    clearTimeout(messageTimer)
    messageTimer = null
  }
}

function showMessage(value) {
  clearMessageTimer()

  message.value = value

  messageTimer = setTimeout(() => {
    copied.value = false
    message.value = ''
    messageTimer = null
  }, 1600)
}

async function writeClipboard(value) {
  try {
    return await copySensitiveText(value)
  } catch {
    return false
  }
}

async function copyValue() {
  if (
    !props.copyable
    || !hasValue.value
  ) {
    return
  }

  const copySucceeded = await writeClipboard(rawValue.value)

  copied.value = copySucceeded

  showMessage(
    copySucceeded
      ? ''
      : t(
        'nc_bitwarden',
        '{label} could not be copied.',
        { label: props.label },
      ),
  )
}

watch(
  [
    () => props.value,
    () => props.revealBlocked,
    () => props.copyable,
  ],
  () => {
    revealed.value = false
    copied.value = false
    expanded.value = false
    message.value = ''
    clearMessageTimer()
  },
)

onBeforeUnmount(() => {
  clearMessageTimer()
})
</script>

<style scoped>
.bw-field-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.55rem;
  padding: 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-field-card--wide {
  grid-column: 1 / -1;
}

.bw-field-card--compact {
  gap: 0.3rem;
  padding: 0.65rem 0.75rem;
}

.bw-field-card__header {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.bw-field-card__label {
  color: var(--color-text-maxcontrast);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0.025em;
  text-transform: uppercase;
}

.bw-field-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.25rem;
}

.bw-field-card__action {
  display: inline-flex;
  width: 32px;
  height: 32px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
  text-decoration: none;
}

.bw-field-card__action--copied {
  color: var(--color-success);
}

.bw-field-card__check {
  font-size: 1.05rem;
  font-weight: 700;
}

.bw-field-card__action:hover,
.bw-field-card__action:focus-visible {
  border-color: var(--color-border);
  background: var(--color-background-hover);
  color: var(--color-primary-element);
}

.bw-field-card__value {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--color-main-text);
  font-size: 1rem;
  font-weight: 500;
  line-height: 1.45;
}

.bw-field-card__value a {
  color: var(--color-primary-element);
  text-decoration: none;
}

.bw-field-card__value a:hover,
.bw-field-card__value a:focus-visible {
  text-decoration: underline;
}

.bw-field-card__value--secret {
  font-family: var(--font-face-monospace);
  font-size: 1.1rem;
  letter-spacing: 0.08em;
}

.bw-field-card__value--empty {
  color: var(--color-text-maxcontrast);
  font-style: italic;
  font-weight: normal;
}

.bw-field-card__toggle {
  align-self: flex-start;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--color-primary-element);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 600;
}

.bw-field-card__toggle:hover,
.bw-field-card__toggle:focus-visible {
  text-decoration: underline;
}

.bw-field-card__hint,
.bw-field-card__message {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.78rem;
}

.bw-field-card__hint {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
