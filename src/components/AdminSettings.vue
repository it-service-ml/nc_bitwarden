<template>
  <div class="bw-settings">
    <h3>{{ t('nc_bitwarden', 'Warden server') }}</h3>

    <p class="bw-settings__desc">
      {{
        t(
          'nc_bitwarden',
          'Choose the default server for all users.',
        )
      }}
    </p>

    <NcNoteCard
      v-if="saved"
      type="success"
    >
      {{ t('nc_bitwarden', 'Administrator settings saved') }}
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
        name="admin_server_type"
        type="radio"
        :disabled="loading || saving"
      >
        ☁️
        {{ t('nc_bitwarden', 'Cloud server (US)') }}
        – <code>bitwarden.com</code>
      </NcCheckboxRadioSwitch>

      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="cloud_eu"
        name="admin_server_type"
        type="radio"
        :disabled="loading || saving"
      >
        🇪🇺
        {{ t('nc_bitwarden', 'Cloud server (EU)') }}
        – <code>bitwarden.eu</code>
      </NcCheckboxRadioSwitch>

      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="selfhosted"
        name="admin_server_type"
        type="radio"
        :disabled="loading || saving"
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
        :disabled="loading || saving"
      />
    </div>

    <div class="bw-settings__override">
      <NcCheckboxRadioSwitch
        v-model="form.allow_user_override"
        type="switch"
        :disabled="loading || saving"
        :description="
          t(
            'nc_bitwarden',
            'When disabled, all users must use this server.',
          )
        "
      >
        {{
          t(
            'nc_bitwarden',
            'Allow users to choose a different server',
          )
        }}
      </NcCheckboxRadioSwitch>
    </div>

    <NcButton
      type="primary"
      :disabled="loading || saving || !!urlError"
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
  allow_user_override: true,
})

const loading = ref(true)
const saving = ref(false)
const saved = ref(false)
const error = ref('')

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

onMounted(async () => {
  try {
    const settings = await VaultwardenApi.getAdminSettings()

    form.server_type = settings.server_type
    form.custom_url = settings.custom_url
    form.allow_user_override = settings.allow_user_override
  } catch {
    error.value = t(
      'nc_bitwarden',
      'Administrator settings could not be loaded',
    )
  } finally {
    loading.value = false
  }
})

async function save() {
  if (urlError.value) {
    return
  }

  saving.value = true
  saved.value = false
  error.value = ''

  try {
    await VaultwardenApi.saveAdminSettings({
      server_type: form.server_type,
      custom_url: form.custom_url,
      allow_user_override: form.allow_user_override,
    })

    saved.value = true

    setTimeout(() => {
      saved.value = false
    }, 3000)
  } catch (exception) {
    error.value = exception.response?.data?.error
      ?? t(
        'nc_bitwarden',
        'Failed to save administrator settings',
      )
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.bw-settings {
  max-width: 620px;
  padding: 1rem 0;
}

.bw-settings__desc {
  margin-bottom: 1rem;
  color: var(--color-text-maxcontrast);
}

.bw-settings__options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.bw-settings__custom {
  margin-bottom: 1rem;
}

.bw-settings__override {
  margin: 1rem 0;
}
</style>
