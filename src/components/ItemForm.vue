<template>
  <NcDialog :name="isEdit ? 'Eintrag bearbeiten' : 'Neuer Eintrag'" @close="$emit('close')" size="normal">
    <div class="bw-form">
      <div class="bw-form__field">
        <label class="bw-form__label">Typ</label>
        <div class="bw-form__radio-group">
          <NcCheckboxRadioSwitch v-for="t in typeOptions" :key="t.id"
            v-model="selectedType" :value="t.id" name="item_type" type="radio" :disabled="isEdit">
            <span class="bw-form__type-option">
              <component :is="t.icon" :size="18" />
              {{ t.label }}
            </span>
          </NcCheckboxRadioSwitch>
        </div>
      </div>

      <NcTextField v-model="form.name" label="Name *" class="bw-form__field" />

      <div class="bw-form__field">
        <label
          class="bw-form__label"
          for="bw-item-folder"
        >
          Persönlicher Ordner
        </label>

        <select
          id="bw-item-folder"
          v-model="form.folderId"
          class="bw-form__select"
        >
          <option value="">
            Kein persönlicher Ordner
          </option>

          <option
            v-for="folder in sortedFolders"
            :key="folder.id"
            :value="folder.id"
          >
            {{ folder.name }}
          </option>
        </select>
      </div>

      <template v-if="selectedType === 1">
        <NcTextField      v-model="form.username" label="Benutzername"    class="bw-form__field" />
        <NcPasswordField  v-model="form.password" label="Passwort"        class="bw-form__field" />
        <NcTextField      v-model="form.uri"      label="URL"             class="bw-form__field" />
        <NcTextField      v-model="form.totp"     label="TOTP (optional)" class="bw-form__field" />
      </template>

      <template v-if="selectedType === 2">
        <div class="bw-form__field">
          <label class="bw-form__label">Notiz</label>
          <textarea v-model="form.notes" class="bw-form__textarea" rows="6" />
        </div>
      </template>

      <template v-if="selectedType === 3">
        <NcTextField v-model="form.cardholderName" label="Karteninhaber" class="bw-form__field" />
        <NcTextField v-model="form.cardNumber"     label="Kartennummer"  class="bw-form__field" />
        <NcTextField v-model="form.expMonth"       label="Monat (MM)"    class="bw-form__field" />
        <NcTextField v-model="form.expYear"        label="Jahr (YYYY)"   class="bw-form__field" />
        <NcTextField v-model="form.cvv"            label="CVV"           class="bw-form__field" />
      </template>

      <template v-if="selectedType === 4">
        <NcTextField v-model="form.firstName" label="Vorname"  class="bw-form__field" />
        <NcTextField v-model="form.lastName"  label="Nachname" class="bw-form__field" />
        <NcTextField v-model="form.idEmail"   label="E-Mail"   class="bw-form__field" />
        <NcTextField v-model="form.phone"     label="Telefon"  class="bw-form__field" />
        <NcTextField v-model="form.address"   label="Adresse"  class="bw-form__field" />
        <NcTextField v-model="form.company"   label="Firma"    class="bw-form__field" />
      </template>

      <NcCheckboxRadioSwitch v-model="form.favorite" type="checkbox">
        Als Favorit markieren
      </NcCheckboxRadioSwitch>

      <p v-if="error" class="bw-form__error">
        {{ error }}
      </p>
    </div>

    <template #actions>
      <NcButton @click="$emit('close')">Abbrechen</NcButton>
      <NcButton type="primary" :disabled="saving || !form.name" @click="save">
        {{ saving ? 'Speichern...' : 'Speichern' }}
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import NcDialog               from '@nextcloud/vue/components/NcDialog'
import NcButton               from '@nextcloud/vue/components/NcButton'
import NcTextField            from '@nextcloud/vue/components/NcTextField'
import NcPasswordField        from '@nextcloud/vue/components/NcPasswordField'
import NcCheckboxRadioSwitch  from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import { BitwardenApi } from '../services/api.js'
import { encryptString, decryptCipher } from '../services/crypto.js'

const props = defineProps({
  userKey: Object,
  item: Object,
  folders: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['saved', 'close'])

const saving       = ref(false)
const error        = ref('')
const isEdit       = computed(() => !!props.item?.id)
const selectedType = ref(props.item?.type ?? 1)

const nameCollator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
})

const sortedFolders = computed(() =>
  [...props.folders].sort((a, b) =>
    nameCollator.compare(a.name ?? '', b.name ?? '')
  )
)

const typeOptions = [
  {
    id: 1,
    label: 'Login',
    icon: KeyOutlineIcon,
  },
  {
    id: 2,
    label: 'Sichere Notiz',
    icon: NoteTextOutlineIcon,
  },
  {
    id: 3,
    label: 'Karte',
    icon: CreditCardOutlineIcon,
  },
  {
    id: 4,
    label: 'Identität',
    icon: IdentityOutlineIcon,
  },
]

const form = reactive({
  name: props.item?.name ?? '',
  folderId: props.item?.folderId ?? '',
  favorite: props.item?.favorite ?? false,
  username: props.item?.login?.username ?? '', password: props.item?.login?.password ?? '',
  uri: props.item?.login?.uris?.[0]?.uri ?? '', totp: props.item?.login?.totp ?? '',
  notes: props.item?.notes ?? '',
  cardholderName: props.item?.card?.cardholderName ?? '', cardNumber: props.item?.card?.number ?? '',
  expMonth: props.item?.card?.expMonth ?? '', expYear: props.item?.card?.expYear ?? '', cvv: props.item?.card?.code ?? '',
  firstName: props.item?.identity?.firstName ?? '', lastName: props.item?.identity?.lastName ?? '',
  idEmail: props.item?.identity?.email ?? '', phone: props.item?.identity?.phone ?? '',
  address: props.item?.identity?.address1 ?? '', company: props.item?.identity?.company ?? '',
})

const enc = (v) => encryptString(v, props.userKey.encKey, props.userKey.macKey)

async function buildPayload() {
  const base = {
    type: Number(selectedType.value),
    name: await enc(form.name),
    notes: form.notes ? await enc(form.notes) : null,
    favorite: Boolean(form.favorite),
    folderId: form.folderId || null,
    organizationId: props.item?.organizationId ?? null,
    fields: [],
    reprompt: 0,
  }

  if (selectedType.value === 1) {
    base.login = {
      username: form.username ? await enc(form.username) : null,
      password: form.password ? await enc(form.password) : null,
      totp: form.totp ? await enc(form.totp) : null,
      uris: form.uri
        ? [{
            uri: await enc(form.uri),
            match: null,
          }]
        : [],
    }
  } else if (selectedType.value === 2) {
    base.secureNote = {
      type: 0,
    }
  } else if (selectedType.value === 3) {
    base.card = {
      cardholderName: form.cardholderName
        ? await enc(form.cardholderName)
        : null,
      number: form.cardNumber
        ? await enc(form.cardNumber)
        : null,
      expMonth: form.expMonth
        ? await enc(form.expMonth)
        : null,
      expYear: form.expYear
        ? await enc(form.expYear)
        : null,
      code: form.cvv
        ? await enc(form.cvv)
        : null,
    }
  } else if (selectedType.value === 4) {
    base.identity = {
      firstName: form.firstName
        ? await enc(form.firstName)
        : null,
      lastName: form.lastName
        ? await enc(form.lastName)
        : null,
      email: form.idEmail
        ? await enc(form.idEmail)
        : null,
      phone: form.phone
        ? await enc(form.phone)
        : null,
      address1: form.address
        ? await enc(form.address)
        : null,
      company: form.company
        ? await enc(form.company)
        : null,
    }
  }

  return base
}

function toPascal(value) {
  if (Array.isArray(value)) {
    return value.map(toPascal)
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, itemValue]) => [
        key.charAt(0).toUpperCase() + key.slice(1),
        toPascal(itemValue),
      ])
    )
  }

  return value
}

async function save() {
  if (saving.value || !form.name.trim()) {
    return
  }

  saving.value = true
  error.value = ''

  try {
    const payload = await buildPayload()

    const raw = isEdit.value
      ? await BitwardenApi.updateCipher(props.item.id, payload)
      : await BitwardenApi.createCipher(payload)

    const decrypted = await decryptCipher(
      toPascal(raw),
      props.userKey,
    )

    emit('saved', decrypted)
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Eintrag konnte nicht gespeichert werden:',
      exception,
    )

    error.value = exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || 'Der Eintrag konnte nicht gespeichert werden.'
  } finally {
    saving.value = false
  }
}

</script>

<style scoped>
.bw-form__field       { margin-bottom: 0.75rem; }
.bw-form__label       { display: block; font-size: 0.75rem; font-weight: 600; color: var(--color-text-maxcontrast); text-transform: uppercase; margin-bottom: 0.25rem; }
.bw-form__type-option {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: currentColor;
}

.bw-form__radio-group { display: flex; flex-wrap: wrap; gap: 0.5rem; }

.bw-form__error {
  margin: 0.75rem 0 0;
  color: var(--color-error);
}

.bw-form__select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-form__textarea    { width: 100%; padding: 0.5rem; border: 1px solid var(--color-border); border-radius: var(--border-radius); background: var(--color-main-background); color: var(--color-main-text); resize: vertical; font-family: inherit; }
</style>
