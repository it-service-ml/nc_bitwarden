<template>
  <div class="bw-login">
    <div class="bw-login__card">
      <img
        src="../../img/app.svg"
        class="bw-login__logo"
        :alt="providerLabel"
      >
      <h2>{{ unlockTitle }}</h2>
      <NcNoteCard v-if="error" type="error">{{ error }}</NcNoteCard>
      <div class="bw-login__field">
        <NcTextField
          v-model="email"
          :label="t('nc_bitwarden', 'Email')"
          type="email"
          :disabled="loading"
        />
      </div>
      <div class="bw-login__field">
        <NcPasswordField
          v-model="masterPassword"
          :label="t('nc_bitwarden', 'Master password')"
          :disabled="loading"
          @keyup.enter="doLogin"
        />
      </div>
      <div class="bw-login__field">
        <NcTextField
          v-model="twoFactorToken"
          :label="t('nc_bitwarden', 'Authenticator code (if enabled)')"
          inputmode="numeric"
          autocomplete="one-time-code"
          :disabled="loading"
          @keyup.enter="doLogin"
        />
      </div>
      <label class="bw-login__remember">
        <input
          v-model="keepUnlocked"
          type="checkbox"
          :disabled="loading"
        >
        <span>{{ t('nc_bitwarden', 'Keep unlocked in this browser tab') }}</span>
      </label>
      <NcButton
        type="primary"
        :disabled="loading || !email || !masterPassword || (twoFactorRequired && !twoFactorToken)"
        wide
        @click="doLogin"
      >
        <template #icon><NcLoadingIcon v-if="loading" :size="20" /></template>
        {{ loading ? t('nc_bitwarden', 'Signing in…') : t('nc_bitwarden', 'Unlock') }}
      </NcButton>
      <p class="bw-login__hint">
        <LockOutlineIcon :size="16" />
        <span>
          {{ t(
            'nc_bitwarden',
            'Your master password never leaves this browser. Only the derived hash is used for authentication.',
          ) }}
        </span>
      </p>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import { VaultwardenApi } from '../services/api.js'
import {
  deriveMasterKeyPBKDF2, deriveMasterKeyArgon2id,
  makeMasterPasswordHash, decryptUserSymmetricKey,
} from '../services/crypto.js'

// camelCase (Vaultwarden) → PascalCase (Bitwarden Cloud) Normalizer
function toPascal(o) {
  if (Array.isArray(o)) return o.map(toPascal)
  if (o !== null && typeof o === 'object') { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), toPascal(v)])) }
  return o
}

const emit = defineEmits(['logged-in'])
const email = ref('')
const masterPassword = ref('')
const twoFactorToken = ref('')
const twoFactorRequired = ref(false)
const keepUnlocked = ref(true)
const loading = ref(false)
const error = ref('')
const serverType = ref('')

const providerLabel = computed(() => {
  if (
    serverType.value === 'cloud_us'
    || serverType.value === 'cloud_eu'
  ) {
    return t('nc_bitwarden', 'Bitwarden')
  }

  if (serverType.value === 'selfhosted') {
    return t('nc_bitwarden', 'Vaultwarden')
  }

  return t('nc_bitwarden', 'Password vault')
})

const unlockTitle = computed(() => {
  if (
    serverType.value === 'cloud_us'
    || serverType.value === 'cloud_eu'
  ) {
    return t('nc_bitwarden', 'Unlock Bitwarden')
  }

  if (serverType.value === 'selfhosted') {
    return t('nc_bitwarden', 'Unlock Vaultwarden')
  }

  return t('nc_bitwarden', 'Unlock password vault')
})

onMounted(async () => {
  const [
    settingsResult,
    profileResult,
  ] = await Promise.allSettled([
    VaultwardenApi.getSettings(),
    VaultwardenApi.getCurrentUserProfile(),
  ])

  if (settingsResult.status === 'fulfilled') {
    serverType.value = settingsResult.value?.server_type ?? ''
  } else {
    console.warn(
      '[nc_bitwarden] Provider settings could not be loaded:',
      settingsResult.reason,
    )
  }

  if (profileResult.status === 'fulfilled') {
    const profileEmail = profileResult.value?.email?.trim()

    if (!email.value && profileEmail) {
      email.value = profileEmail
    }
  } else {
    console.warn(
      '[nc_bitwarden] Nextcloud email could not be loaded:',
      profileResult.reason,
    )
  }
})

async function doLogin() {
  error.value = ''
  loading.value = true
  try {
    const kdfParams = await VaultwardenApi.prelogin(email.value)

    // Bitwarden API gibt PascalCase zurück (Kdf, KdfIterations, KdfMemory, KdfParallelism)
    // Normalisierung: beide Varianten abfangen
    const kdfType = kdfParams.Kdf ?? kdfParams.kdf ?? 0
    // Plausibilitätsprüfung gegen DoS durch manipulierte KDF-Parameter
    const kdfIterations = Math.min(kdfParams.KdfIterations ?? kdfParams.kdfIterations ?? 600000, 2_000_000)
    const kdfMemory = Math.min(kdfParams.KdfMemory ?? kdfParams.kdfMemory ?? 64, 256)
    const kdfParallelism = Math.min(kdfParams.KdfParallelism ?? kdfParams.kdfParallelism ?? 4, 16)

    let masterKeyBuffer
    if (kdfType === 1) {
      // Argon2id
      masterKeyBuffer = await deriveMasterKeyArgon2id(
        masterPassword.value, email.value,
        kdfMemory, kdfIterations, kdfParallelism,
      )
    } else {
      // PBKDF2-SHA256 (Standard)
      masterKeyBuffer = await deriveMasterKeyPBKDF2(
        masterPassword.value, email.value, kdfIterations,
      )
    }

    const passwordHash = await makeMasterPasswordHash(masterKeyBuffer, masterPassword.value)
    // Login-Response normalisieren (Vaultwarden: camelCase, Bitwarden Cloud: PascalCase)
    const submittedTwoFactorToken = twoFactorToken.value.trim()

    const loginData = toPascal(await VaultwardenApi.login(
      email.value,
      passwordHash,
      submittedTwoFactorToken || null,
    ))

    if (loginData.TwoFactorRequired) {
      const providers = loginData.TwoFactorProviders ?? []

      if (!providers.map(Number).includes(0)) {
        throw new Error(t('nc_bitwarden', 'Two-factor authentication is required, but TOTP is not available.'))
      }

      twoFactorRequired.value = true
      twoFactorToken.value = ''
      error.value = submittedTwoFactorToken
        ? t('nc_bitwarden', 'The authenticator code is invalid or has expired.')
        : t('nc_bitwarden', 'Enter the code from your authenticator app.')
      return
    }

    // Nach Normalisierung immer PascalCase: 'Key'
    const encUserKey = loginData.Key
    if (!encUserKey) {
      throw new Error(t('nc_bitwarden', 'No user key was returned. Check your email address and password.'))
    }

    const userKey = await decryptUserSymmetricKey(encUserKey, masterKeyBuffer)
    twoFactorToken.value = ''
    twoFactorRequired.value = false
    masterPassword.value = ''
    emit('logged-in', {
      masterKey: userKey,
      loginData,
      keepUnlocked: keepUnlocked.value,
    })

  } catch (e) {
    // Axios-Fehler: e.response.data.error  |  direkter Fehler: e.message
    const serverMsg = e.response?.data?.error ?? e.response?.data?.message
    error.value = serverMsg ?? e.message ?? t('nc_bitwarden', 'Sign-in failed')
    console.error('[nc_bitwarden] Login-Fehler:', e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.bw-login {
  display: flex;
  height: 100%;
  padding: 2rem;
  align-items: center;
  justify-content: center;
}

.bw-login__card {
  width: 100%;
  max-width: 400px;
  padding: 2rem;
  border-radius: var(--border-radius-large);
  background: var(--color-main-background);
  box-shadow: var(--box-shadow);
}

.bw-login__logo {
  display: block;
  width: 64px;
  margin: 0 auto 0.6rem;
}

.bw-login__card h2 {
  margin: 0 0 0.9rem;
  text-align: center;
  font-size: 1.65rem;
  line-height: 1.2;
}

.bw-login__field {
  margin-bottom: 0.8rem;
}
.bw-login__remember {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 0.15rem 0 1rem;
  font-size: 0.9rem;
  cursor: pointer;
}
.bw-login__remember input {
  width: 18px;
  height: 18px;
}
.bw-login__hint  { font-size: 0.8rem; color: var(--color-text-maxcontrast); margin-top: 1rem; text-align: center; }
</style>
