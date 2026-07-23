<template>
  <div class="bw-detail">
    <header class="bw-detail__header">
      <div class="bw-detail__title">
        <span class="bw-detail__eyebrow">
          {{ t('nc_bitwarden', 'Item') }}
        </span>

        <h2>
          {{ itemName }}
        </h2>
      </div>

      <div class="bw-detail__actions">
        <NcButton
          :title="t('nc_bitwarden', 'Edit item')"
          :aria-label="t('nc_bitwarden', 'Edit item')"
          @click="$emit('edit', item)"
        >
          <PencilOutlineIcon :size="18" />
        </NcButton>

        <NcButton
          type="error"
          :title="t('nc_bitwarden', 'Delete item')"
          :aria-label="t('nc_bitwarden', 'Delete item')"
          @click="confirmDelete"
        >
          <DeleteOutlineIcon :size="18" />
        </NcButton>
      </div>
    </header>

    <div class="bw-detail__content">
      <template v-if="item.type === 1 && item.login">
        <section class="bw-detail__group">
          <div class="bw-detail__group-title">
            {{ t('nc_bitwarden', 'Login credentials') }}
          </div>

          <div class="bw-detail__grid">
            <FieldRow
              :label="t('nc_bitwarden', 'Username')"
              :value="item.login.username"
              copyable
            />

            <FieldRow
              :label="t('nc_bitwarden', 'Password')"
              :value="item.login.password"
              copyable
              secret
            />

            <FieldRow
              v-for="(uri, index) in item.login.uris ?? []"
              :key="`${uri.uri}-${index}`"
              :label="
                item.login.uris.length > 1
                  ? t(
                    'nc_bitwarden',
                    'URL {number}',
                    { number: index + 1 },
                  )
                  : t('nc_bitwarden', 'URL')
              "
              :value="uri.uri"
              :href="uri.uri"
              copyable
              wide
            />
          </div>
        </section>

        <TotpDisplay
          v-if="item.login.totp"
          :secret="item.login.totp"
        />
      </template>

      <section
        v-if="item.type === 3 && item.card"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Card details') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            :label="t('nc_bitwarden', 'Cardholder')"
            :value="item.card.cardholderName"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Card number')"
            :value="item.card.number"
            copyable
            secret
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Expiration date')"
            :value="expirationDate"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'CVV')"
            :value="item.card.code"
            copyable
            secret
          />
        </div>
      </section>

      <section
        v-if="item.type === 4 && item.identity"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Identity') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            :label="t('nc_bitwarden', 'Name')"
            :value="identityName"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Email')"
            :value="item.identity.email"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Phone')"
            :value="item.identity.phone"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Company')"
            :value="item.identity.company"
            copyable
          />

          <FieldRow
            :label="t('nc_bitwarden', 'Address')"
            :value="item.identity.address1"
            copyable
            wide
          />
        </div>
      </section>

      <section
        v-if="item.notes"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Notes') }}
        </div>

        <article class="bw-detail__notes-card">
          <p>{{ item.notes }}</p>

          <button
            type="button"
            class="bw-detail__copy-notes"
            :title="t('nc_bitwarden', 'Copy notes')"
            :aria-label="t('nc_bitwarden', 'Copy notes')"
            @click="copyNotes"
          >
            <ContentCopyIcon :size="18" />
          </button>
        </article>

        <p
          v-if="notesMessage"
          class="bw-detail__message"
          aria-live="polite"
        >
          {{ notesMessage }}
        </p>
      </section>

      <section
        v-if="item.fields?.length"
        class="bw-detail__group"
      >
        <div class="bw-detail__group-title">
          {{ t('nc_bitwarden', 'Additional fields') }}
        </div>

        <div class="bw-detail__grid">
          <FieldRow
            v-for="(field, index) in item.fields"
            :key="`${field.name}-${index}`"
            :label="field.name || t(
              'nc_bitwarden',
              'Field {number}',
              { number: index + 1 },
            )"
            :value="field.value"
            :secret="field.type === 1"
            copyable
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import {
  computed,
  onBeforeUnmount,
  ref,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import DeleteOutlineIcon from 'vue-material-design-icons/DeleteOutline.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'
import FieldRow from './FieldRow.vue'
import TotpDisplay from './TotpDisplay.vue'
import { VaultwardenApi } from '../services/api.js'

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
  userKey: {
    type: Object,
    default: null,
  },
})

const emit = defineEmits([
  'edit',
  'delete',
])

const notesMessage = ref('')

const itemName = computed(() =>
  props.item.name || t('nc_bitwarden', '(no name)'),
)

let notesTimer = null

const expirationDate = computed(() => {
  const month = props.item.card?.expMonth
  const year = props.item.card?.expYear

  if (!month && !year) {
    return ''
  }

  return [
    month,
    year,
  ].filter(Boolean).join('/')
})

const identityName = computed(() =>
  [
    props.item.identity?.firstName,
    props.item.identity?.lastName,
  ]
    .filter(Boolean)
    .join(' '),
)

async function confirmDelete() {
  if (
    !confirm(
      t(
        'nc_bitwarden',
        'Really delete {name}?',
        { name: itemName.value },
      ),
    )
  ) {
    return
  }

  await VaultwardenApi.deleteCipher(props.item.id)
  emit('delete', props.item.id)
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

async function copyNotes() {
  const copied = await writeClipboard(
    String(props.item.notes ?? ''),
  )

  notesMessage.value = copied
    ? t('nc_bitwarden', 'Notes were copied.')
    : t('nc_bitwarden', 'Notes could not be copied.')

  if (notesTimer) {
    clearTimeout(notesTimer)
  }

  notesTimer = setTimeout(() => {
    notesMessage.value = ''
  }, 2200)
}

onBeforeUnmount(() => {
  if (notesTimer) {
    clearTimeout(notesTimer)
  }
})
</script>

<style scoped>
.bw-detail {
  height: 100%;
  overflow-y: auto;
  background: var(--color-main-background);
}

.bw-detail__header {
  position: sticky;
  z-index: 5;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-main-background);
}

.bw-detail__title {
  min-width: 0;
}

.bw-detail__eyebrow {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.bw-detail__title h2 {
  overflow: hidden;
  margin: 0;
  font-size: 1.35rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-detail__actions {
  display: flex;
  flex-shrink: 0;
  gap: 0.5rem;
}

.bw-detail__content {
  padding-bottom: 1rem;
}

.bw-detail__group {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin: 0.75rem 1rem;
  padding: 1rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius-large);
  background: var(--color-background-dark);
}

.bw-detail__group-title {
  font-size: 1rem;
  font-weight: 600;
}

.bw-detail__grid {
  display: grid;
  grid-template-columns: repeat(
    auto-fit,
    minmax(230px, 1fr)
  );
  gap: 0.75rem;
}

.bw-detail__notes-card {
  position: relative;
  min-height: 90px;
  padding: 0.85rem 3.25rem 0.85rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
}

.bw-detail__notes-card p {
  margin: 0;
  overflow-wrap: anywhere;
  line-height: 1.5;
  white-space: pre-wrap;
}

.bw-detail__copy-notes {
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  display: flex;
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
}

.bw-detail__copy-notes:hover,
.bw-detail__copy-notes:focus-visible {
  border-color: var(--color-border);
  background: var(--color-background-hover);
  color: var(--color-primary-element);
}

.bw-detail__message {
  margin: 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.8rem;
}

@media (max-width: 700px) {
  .bw-detail__header {
    align-items: flex-start;
  }

  .bw-detail__grid {
    grid-template-columns: 1fr;
  }

  .bw-detail__group {
    margin-right: 0.5rem;
    margin-left: 0.5rem;
  }
}
</style>
