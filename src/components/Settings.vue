<template>
  <div class="bw-settings">
    <h3>{{ t('nc_bitwarden', 'Vaultwarden server') }}</h3>
    <p class="bw-settings__desc">
      {{ t('nc_bitwarden', 'Select your vault server and save the settings.') }}
    </p>

    <NcNoteCard v-if="saved" type="success">
      ✅ {{ t('nc_bitwarden', 'Settings saved') }}
    </NcNoteCard>
    <NcNoteCard v-if="error" type="error">{{ error }}</NcNoteCard>

    <div class="bw-settings__options">
      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="cloud_us"
        name="server_type"
        type="radio"
      >
        ☁️ {{ t('nc_bitwarden', 'Cloud server (US)') }} – <code>bitwarden.com</code>
      </NcCheckboxRadioSwitch>
      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="cloud_eu"
        name="server_type"
        type="radio"
      >
        🇪🇺 {{ t('nc_bitwarden', 'Cloud server (EU)') }} – <code>bitwarden.eu</code>
      </NcCheckboxRadioSwitch>
      <NcCheckboxRadioSwitch
        v-model="form.server_type"
        value="selfhosted"
        name="server_type"
        type="radio"
      >
        🏠 {{ t('nc_bitwarden', 'Self-hosted Vaultwarden server') }}
      </NcCheckboxRadioSwitch>
    </div>

    <div v-if="form.server_type === 'selfhosted'" class="bw-settings__custom">
      <NcTextField
        v-model="form.custom_url"
        :label="t('nc_bitwarden', 'Server URL')"
        placeholder="https://vault.meine-domain.de"
        :helper-text="urlError || t('nc_bitwarden', 'Base URL without /api or /identity')"
      />
    </div>

    <NcButton type="primary" :disabled="saving || !!urlError" @click="save">
      {{ saving ? t('nc_bitwarden', 'Saving…') : t('nc_bitwarden', 'Save') }}
    </NcButton>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import { VaultwardenApi } from '../services/api.js'

const form = reactive({ server_type: 'cloud_us', custom_url: '' })
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

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return t('nc_bitwarden', 'Only HTTP or HTTPS URLs are allowed')
    }

    return ''
  } catch {
    return t('nc_bitwarden', 'Invalid URL')
  }
})

onMounted(async () => {
  try {
    const s = await VaultwardenApi.getSettings()
    form.server_type = s.server_type
    form.custom_url = s.custom_url
  } catch (e) { error.value = t('nc_bitwarden', 'Settings could not be loaded') }
})

async function save() {
  if (urlError.value) return
  saving.value = true; error.value = ''
  try {
    await VaultwardenApi.saveSettings({ server_type: form.server_type, custom_url: form.custom_url })
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
  } catch (e) {
    error.value = e.response?.data?.error ?? t('nc_bitwarden', 'Failed to save settings')
  } finally { saving.value = false }
}
</script>

<style scoped>
.bw-settings          { padding: 1rem 0; max-width: 560px; }
.bw-settings__desc    { color: var(--color-text-maxcontrast); margin-bottom: 1rem; }
.bw-settings__options { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
.bw-settings__custom  { margin-bottom: 1rem; }
</style>
