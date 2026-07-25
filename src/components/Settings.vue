<template>
  <div class="bw-settings">
    <h3>{{ t('nc_bitwarden', 'Warden server') }}</h3>

    <p class="bw-settings__desc">
      {{
        t(
          'nc_bitwarden',
          'Select your vault server and save the settings.',
        )
      }}
    </p>

    <NcNoteCard
      v-if="!canEdit"
      type="info"
    >
      {{
        t(
          'nc_bitwarden',
          'The server is defined by your administrator and cannot be changed.',
        )
      }}
    </NcNoteCard>

    <NcNoteCard
      v-else-if="inherited"
      type="info"
    >
      {{
        t(
          'nc_bitwarden',
          'You are using the administrator default. Saving creates a personal selection.',
        )
      }}
    </NcNoteCard>

    <NcNoteCard
      v-if="saved"
      type="success"
    >
      {{ t('nc_bitwarden', 'Settings saved') }}
    </NcNoteCard>

    <NcNoteCard
      v-if="error"
      type="error"
    >
      {{ error }}
    </NcNoteCard>

    <div class="bw-settings__options">
      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="cloud_us"
        name="server_type"
        type="radio"
        :disabled="!canEdit || saving"
      >
        ☁️
        {{ t('nc_bitwarden', 'Cloud server (US)') }}
        – <code>bitwarden.com</code>
      </NcCheckboxRadioSwitch>

      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="cloud_eu"
        name="server_type"
        type="radio"
        :disabled="!canEdit || saving"
      >
        🇪🇺
        {{ t('nc_bitwarden', 'Cloud server (EU)') }}
        – <code>bitwarden.eu</code>
      </NcCheckboxRadioSwitch>

      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="selfhosted"
        name="server_type"
        type="radio"
        :disabled="!canEdit || saving"
      >
        🏠
        {{ t('nc_bitwarden', 'Self-hosted Vaultwarden server') }}
      </NcCheckboxRadioSwitch>
    </div>

    <div
      v-if="form.server_type === 'selfhosted'"
      class="bw-settings__custom"
    >
      <NcTextField
        v-model="form.custom_url"
        :label="t('nc_bitwarden', 'Server URL')"
        placeholder="https://vault.example.com"
        :helper-text="
          urlError
            || t(
              'nc_bitwarden',
              'Base URL without /api or /identity',
            )
        "
        :disabled="!canEdit || saving"
      />
    </div>

    <div
      v-if="classicLoginAllowed"
      class="bw-settings__email"
    >
      <h4>
        {{ t('nc_bitwarden', 'Login email') }}
      </h4>

      <NcCheckboxRadioSwitch
        v-model="form.use_nextcloud_email"
        class="bw-settings__compact-switch"
        type="switch"
        :disabled="saving"
      >
        {{
          t(
            'nc_bitwarden',
            'Use email address from Nextcloud',
          )
        }}
      </NcCheckboxRadioSwitch>

      <NcTextField
        v-if="!form.use_nextcloud_email"
        v-model="form.login_email"
        type="email"
        autocomplete="email"
        :label="
          t(
            'nc_bitwarden',
            'Email address for Bitwarden/Vaultwarden login',
          )
        "
        :helper-text="
          emailError
            || t(
              'nc_bitwarden',
              'This address is used for the classic Bitwarden/Vaultwarden login.',
            )
        "
        :disabled="saving"
      />

      <p class="bw-settings__email-hint">
        {{
          t(
            'nc_bitwarden',
            'For SSO, the email address supplied by the identity provider is used.',
          )
        }}
      </p>
    </div>

    <NcButton
      variant="primary"
      :disabled="saving || !!urlError || !!emailError"
      @click="save"
    >
      {{
        saving
          ? t('nc_bitwarden', 'Saving…')
          : t('nc_bitwarden', 'Save')
      }}
    </NcButton>
  </div>
</template>

<script setup>

import {
  computed,
  onMounted,
  reactive,
  ref,
} from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { VaultwardenApi } from '../services/api.js'

const form = reactive({
  server_type: 'cloud_us',
  custom_url: '',
  use_nextcloud_email: true,
  login_email: '',
})

const canEdit = ref(true)
const classicLoginAllowed = ref(true)
const inherited = ref(false)
const saved = ref(false)
const error = ref('')
const saving = ref(false)

const urlError = computed(() => {
  if (
    form.server_type !== 'selfhosted'
    || !form.custom_url
  ) {
    return ''
  }

  try {
    const parsedUrl = new URL(form.custom_url)

    if (parsedUrl.protocol !== 'https:') {
      return t(
        'nc_bitwarden',
        'Only HTTPS URLs are allowed',
      )
    }

    return ''
  } catch {
    return t('nc_bitwarden', 'Invalid URL')
  }
})

const emailError = computed(() => {
  if (!classicLoginAllowed.value) {
    return ''
  }

  if (form.use_nextcloud_email) {
    return ''
  }

  const value = form.login_email.trim()

  if (!value) {
    return t(
      'nc_bitwarden',
      'Enter a valid email address',
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return t(
      'nc_bitwarden',
      'Enter a valid email address',
    )
  }

  return ''
})

onMounted(async () => {
  try {
    const settings = await VaultwardenApi.getSettings()

    form.server_type = settings.server_type
    form.custom_url = settings.custom_url
    form.use_nextcloud_email
      = settings.use_nextcloud_email !== false
    form.login_email = settings.login_email ?? ''
    classicLoginAllowed.value
      = settings.classic_login_allowed !== false
    canEdit.value = settings.can_edit !== false
    inherited.value = settings.inherited === true
  } catch {
    error.value = t(
      'nc_bitwarden',
      'Settings could not be loaded',
    )
  }
})

async function save() {
  if (urlError.value || emailError.value) {
    return
  }

  saving.value = true
  saved.value = false
  error.value = ''

  try {
    await VaultwardenApi.saveSettings({
      server_type: form.server_type,
      custom_url: form.custom_url,
      use_nextcloud_email: form.use_nextcloud_email,
      login_email: form.login_email.trim(),
    })

    inherited.value = false
    saved.value = true

    setTimeout(() => {
      saved.value = false
    }, 3000)
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? t(
        'nc_bitwarden',
        'Failed to save settings',
      )
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-settings {
  max-width: 560px;
  padding: 1rem 2rem 2rem;
}

.bw-settings__desc {
  margin-bottom: 1rem;
  color: var(--color-text-maxcontrast);
}

.bw-settings__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin: 1rem 0;
}

.bw-settings__custom {
  margin-bottom: 1rem;
}
.bw-settings__email {
  margin: 1.5rem 0;
}

.bw-settings__email h4 {
  margin-bottom: 0.75rem;
}

.bw-settings__email-hint {
  margin: 0.5rem 0 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.9rem;
}

.bw-settings__compact-switch {
  display: inline-flex;
  width: fit-content;
}

/*
 * Der Nextcloud-Schalter färbt sonst beim Hover/Fokus die komplette
 * Beschriftungszeile ein. Gewünscht ist ausschließlich der kompakte Toggle.
 */
.bw-settings__compact-switch :deep(.checkbox-radio-switch__content),
.bw-settings__compact-switch :deep(.checkbox-radio-switch__content:hover) {
  padding-inline: 0 !important;
  background: transparent !important;
  border-radius: 0 !important;
}

@media (max-width: 600px) {
  .bw-settings {
    padding-inline: 1rem;
  }
}

</style>
