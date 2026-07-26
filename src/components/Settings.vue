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

    <section
      v-if="passkeyUnlockEnabled"
      class="bw-settings__passkey"
    >
      <h3>
        {{ t('nc_bitwarden', 'Check passkey compatibility') }}
      </h3>

      <p class="bw-settings__desc">
        {{
          t(
            'nc_bitwarden',
            'Check whether this browser and security key support the WebAuthn PRF extension required for passkey-based vault unlock. This check does not configure passkey unlock.',
          )
        }}
      </p>

      <p class="bw-settings__desc">
        {{
          t(
            'nc_bitwarden',
            'Set up passkey vault unlock in Warden settings after unlocking the vault.',
          )
        }}
      </p>

      <NcNoteCard
        v-if="!passkeyEnvironment.secureContext"
        type="warning"
      >
        {{
          t(
            'nc_bitwarden',
            'Checking passkey compatibility requires a secure HTTPS connection.',
          )
        }}
      </NcNoteCard>

      <NcNoteCard
        v-else-if="!passkeyEnvironment.webAuthnAvailable"
        type="warning"
      >
        {{
          t(
            'nc_bitwarden',
            'WebAuthn is not available in this browser.',
          )
        }}
      </NcNoteCard>

      <NcNoteCard
        v-else-if="passkeyEnvironment.clientPrfSupported === true"
        type="info"
      >
        {{
          t(
            'nc_bitwarden',
            'The browser reports WebAuthn PRF support. The security key must still be tested.',
          )
        }}
      </NcNoteCard>

      <NcNoteCard
        v-else
        type="info"
      >
        {{
          t(
            'nc_bitwarden',
            'The browser capability report is inconclusive. The practical security-key test provides the final result.',
          )
        }}
      </NcNoteCard>

      <NcNoteCard
        v-if="passkeyTestStatus === 'success'"
        type="success"
      >
        {{ passkeyTestMessage }}
      </NcNoteCard>

      <NcNoteCard
        v-else-if="passkeyTestStatus === 'unsupported'"
        type="warning"
      >
        {{ passkeyTestMessage }}
      </NcNoteCard>

      <NcNoteCard
        v-else-if="passkeyTestStatus === 'error'"
        type="error"
      >
        {{ passkeyTestMessage }}
      </NcNoteCard>

      <NcButton
        variant="secondary"
        :disabled="passkeyTestDisabled"
        @click="runPasskeyPrfTest"
      >
        <template #icon>
          <NcLoadingIcon
            v-if="passkeyTesting"
            :size="20"
          />
        </template>

        {{
          passkeyTesting
            ? t('nc_bitwarden', 'Checking compatibility…')
            : t('nc_bitwarden', 'Check compatibility')
        }}
      </NcButton>

      <p class="bw-settings__passkey-hint">
        {{
          t(
            'nc_bitwarden',
            'The check creates a temporary non-discoverable credential. Warden does not retain its identifier and cannot reuse it. No vault key or passkey secret is stored.',
          )
        }}
      </p>
    </section>
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
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import { VaultwardenApi } from '../services/api.js'
import {
  inspectPasskeyPrfEnvironment,
  testPasskeyPrf,
} from '../services/passkeyPrf.js'

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

const passkeyUnlockEnabled = ref(false)

const passkeyEnvironment = ref({
  secureContext: globalThis.isSecureContext === true,
  webAuthnAvailable: false,
  capabilitiesAvailable: false,
  clientPrfSupported: null,
})

const passkeyTesting = ref(false)
const passkeyTestStatus = ref('idle')
const passkeyTestMessage = ref('')

const passkeyTestDisabled = computed(() => (
  passkeyTesting.value
  || !passkeyEnvironment.value.secureContext
  || !passkeyEnvironment.value.webAuthnAvailable
))

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
  passkeyEnvironment.value
    = await inspectPasskeyPrfEnvironment()

  try {
    const settings = await VaultwardenApi.getSettings()

    form.server_type = settings.server_type
    form.custom_url = settings.custom_url
    form.use_nextcloud_email
      = settings.use_nextcloud_email !== false
    form.login_email = settings.login_email ?? ''
    classicLoginAllowed.value
      = settings.classic_login_allowed !== false
    passkeyUnlockEnabled.value
      = settings.passkey_unlock_enabled === true
    canEdit.value = settings.can_edit !== false
    inherited.value = settings.inherited === true
  } catch {
    error.value = t(
      'nc_bitwarden',
      'Settings could not be loaded',
    )
  }
})

async function runPasskeyPrfTest() {
  passkeyTesting.value = true
  passkeyTestStatus.value = 'idle'
  passkeyTestMessage.value = ''

  try {
    const result = await testPasskeyPrf()

    if (result.supported) {
      passkeyTestStatus.value = 'success'
      passkeyTestMessage.value = t(
        'nc_bitwarden',
        'Success: This browser and security key support WebAuthn PRF. Passkey-based vault unlock can be used on this device.',
      )

      return
    }

    passkeyTestStatus.value = 'unsupported'

    const messages = {
      insecure_context: t(
        'nc_bitwarden',
        'Checking passkey compatibility requires a secure HTTPS connection.',
      ),
      webauthn_unavailable: t(
        'nc_bitwarden',
        'WebAuthn is not available in this browser.',
      ),
      cancelled: t(
        'nc_bitwarden',
        'The compatibility check was cancelled or timed out.',
      ),
      not_supported: t(
        'nc_bitwarden',
        'The browser or security key rejected the WebAuthn PRF extension.',
      ),
      security_error: t(
        'nc_bitwarden',
        'The current origin or browser policy blocks WebAuthn.',
      ),
      user_verification_unavailable: t(
        'nc_bitwarden',
        'The security key cannot perform the required user verification. Check whether a FIDO2 PIN is configured.',
      ),
      authenticator_prf_unavailable: t(
        'nc_bitwarden',
        'The selected security key does not support WebAuthn PRF.',
      ),
      prf_output_unavailable: t(
        'nc_bitwarden',
        'The security key reported PRF support but did not return a usable PRF result.',
      ),
      registration_failed: t(
        'nc_bitwarden',
        'The temporary passkey credential could not be created.',
      ),
    }

    passkeyTestMessage.value
      = messages[result.reason]
        ?? t(
          'nc_bitwarden',
          'The passkey compatibility check was not successful.',
        )
  } catch (exception) {
    passkeyTestStatus.value = 'error'
    passkeyTestMessage.value = exception.message
      ?? t(
        'nc_bitwarden',
        'The passkey compatibility check failed unexpectedly.',
      )

    console.error(
      '[nc_bitwarden] Passkey PRF test failed:',
      exception,
    )
  } finally {
    passkeyTesting.value = false
  }
}

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

.bw-settings__passkey {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.bw-settings__passkey .notecard {
  margin-bottom: 0.75rem;
}

.bw-settings__passkey-hint {
  margin: 0.75rem 0 0;
  color: var(--color-text-maxcontrast);
  font-size: 0.85rem;
  line-height: 1.4;
}

@media (max-width: 600px) {
  .bw-settings {
    padding-inline: 1rem;
  }
}

</style>
