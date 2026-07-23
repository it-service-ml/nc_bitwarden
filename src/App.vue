<template>
  <div class="bw-app">
    <div v-if="restoringSession" class="bw-session-restore">
      <NcLoadingIcon :size="48" />
      <p>Tresor-Sitzung wird wiederhergestellt…</p>
    </div>

    <LoginForm
      v-else-if="!isLoggedIn"
      @logged-in="onLoggedIn"
    />

    <div v-else class="bw-layout">
      <!-- Linke Sidebar: Vault-Liste -->
      <aside class="bw-layout__sidebar">
        <VaultList
          :items="items"
          :folders="folders"
          :collections="collections"
          :selected-id="selectedItem?.id"
          @select="selectedItem = $event; showForm = false"
          @new="openNewForm"
          @logout="logout"
          @filter-change="onFilterChange"
          @navigate="showVaultList"
        />
      </aside>

      <!-- Mittlere Spalte: gefilterte Einträge -->
      <section class="bw-layout__items">
        <VaultItems
          :items="visibleItems"
          :title="activeFilterLabel"
          :selected-id="selectedItem?.id"
          @select="
            selectedItem = $event;
            showForm = false;
            editItem = null
          "
        />
      </section>

      <!-- Rechte Spalte: Detailansicht oder Formular -->
      <main class="bw-layout__main">
        <div v-if="loading" class="bw-main__loading">
          <NcLoadingIcon :size="48" />
          <p>Vault wird entschlüsselt…</p>
        </div>

        <ItemDetail
          v-else-if="selectedItem && !showForm"
          :item="selectedItem"
          :user-key="userKey"
          @delete="onDelete"
          @edit="openEditForm"
        />

        <ItemForm
          v-else-if="showForm"
          :item="editItem"
          :user-key="userKey"
          :folders="folders"
          @close="showForm = false; editItem = null"
          @saved="onSaved"
        />

        <div v-else class="bw-main__empty">
          <LockOutlineIcon :size="56" />
          <h3>Tresor entsperrt</h3>
          <p>Wähle einen Eintrag aus der mittleren Spalte.</p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import LockOutlineIcon      from 'vue-material-design-icons/LockOutline.vue'
import LoginForm     from './components/LoginForm.vue'
import VaultList     from './components/VaultList.vue'
import VaultItems    from './components/VaultItems.vue'
import ItemDetail    from './components/ItemDetail.vue'
import ItemForm      from './components/ItemForm.vue'
import { BitwardenApi } from './services/api.js'
import {
  decryptCipher, decryptEncString,
  decryptRsaPrivateKey, decryptOrgKeys,
} from './services/crypto.js'
import {
  clearSessionKey,
  restoreSessionKey,
  saveSessionKey,
} from './services/sessionKeyStore.js'

// camelCase (Vaultwarden) → PascalCase (Bitwarden Cloud) Normalizer
function toPascal(o) {
  if (Array.isArray(o)) return o.map(toPascal)
  if (o !== null && typeof o === 'object')
    return Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), toPascal(v)]))
  return o
}

const restoringSession = ref(true)
const isLoggedIn   = ref(false)
const userKey      = ref(null)
const items             = ref([])
const folders           = ref([])
const collections       = ref([])
const visibleItems      = ref([])
const activeFilterLabel = ref('Alle Einträge')
const selectedItem      = ref(null)
const loading      = ref(false)
const showForm     = ref(false)
const editItem     = ref(null)

async function onLoggedIn({ masterKey, keepUnlocked = true }) {
  userKey.value    = masterKey
  isLoggedIn.value = true

  if (keepUnlocked) {
    saveSessionKey(masterKey)
  } else {
    clearSessionKey()
  }

  const loaded = await loadVault()

  if (!loaded) {
    clearSessionKey()
    resetVaultState()
  }
}

async function loadVault() {
  loading.value = true
  try {
    const sync = toPascal(await BitwardenApi.sync())

    // Org-Keys via RSA entschlüsseln
    let orgKeys = {}
    const orgs = sync.Profile?.Organizations ?? []
    if (sync.Profile?.PrivateKey && orgs.length > 0) {
      try {
        const rsaKey = await decryptRsaPrivateKey(sync.Profile.PrivateKey, userKey.value)
        orgKeys      = await decryptOrgKeys(orgs, rsaKey)
        console.info(`[nc_bitwarden] ${Object.keys(orgKeys).length}/${orgs.length} Org-Keys entschlüsselt`)
      } catch (e) {
        console.warn('[nc_bitwarden] Org-Key Entschlüsselung fehlgeschlagen:', e.message)
      }
    }

    // Ordner
    const folderResults = await Promise.allSettled(
      (sync.Folders ?? []).map(async f => ({
        id:   f.Id,
        name: await decryptEncString(f.Name, userKey.value.encKey, userKey.value.macKey),
      }))
    )
    folders.value = folderResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)

    // Sammlungen gehören Organisationen und werden mit dem jeweiligen
    // Organisationsschlüssel entschlüsselt.
    const collectionResults = await Promise.allSettled(
      (sync.Collections ?? []).map(async collection => {
        const orgKey = orgKeys[collection.OrganizationId]

        if (!orgKey) {
          throw new Error(
            `Kein Organisationsschlüssel für Sammlung ${collection.Id}`
          )
        }

        const name = collection.DefaultUserCollectionEmail
          || await decryptEncString(
            collection.Name,
            orgKey.encKey,
            orgKey.macKey,
          )

        return {
          id: collection.Id,
          organizationId: collection.OrganizationId,
          name,
          readOnly: Boolean(collection.ReadOnly),
          hidePasswords: Boolean(collection.HidePasswords),
          manage: Boolean(collection.Manage),
          type: collection.Type ?? 0,
        }
      })
    )

    const failedCollections = collectionResults
      .filter(result => result.status === 'rejected')

    if (failedCollections.length > 0) {
      console.warn(
        `[nc_bitwarden] ${failedCollections.length} Sammlungen konnten nicht entschlüsselt werden`
      )
    }

    collections.value = collectionResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)

    // Ciphers – ein Fehler killt nicht alle anderen
    const cipherResults = await Promise.allSettled(
      (sync.Ciphers ?? []).map(c => decryptCipher(c, userKey.value, orgKeys))
    )
    const failed = cipherResults.filter(r => r.status === 'rejected').length
    if (failed > 0) console.warn(`[nc_bitwarden] ${failed} Einträge konnten nicht entschlüsselt werden`)
    items.value = cipherResults.filter(r => r.status === 'fulfilled').map(r => r.value)

    console.info(
      `[nc_bitwarden] Vault geladen: ${items.value.length} Einträge, `
      + `${folders.value.length} Ordner, ${collections.value.length} Sammlungen`
    )
    return true
  } catch (e) {
    console.error('[nc_bitwarden] loadVault Fehler:', e)
    return false
  } finally {
    loading.value = false
  }
}

function resetVaultState() {
  userKey.value = null
  isLoggedIn.value = false
  items.value = []
  folders.value = []
  collections.value = []
  visibleItems.value = []
  activeFilterLabel.value = 'Alle Einträge'
  selectedItem.value = null
  showForm.value = false
  editItem.value = null
}

function logout() {
  clearSessionKey()
  resetVaultState()
}

onMounted(async () => {
  try {
    const restoredKey = restoreSessionKey()

    if (!restoredKey) {
      return
    }

    userKey.value = restoredKey
    isLoggedIn.value = true

    const loaded = await loadVault()

    if (!loaded) {
      clearSessionKey()
      resetVaultState()
    }
  } finally {
    restoringSession.value = false
  }
})

function onFilterChange({ items: filteredItems, label }) {
  visibleItems.value = Array.isArray(filteredItems)
    ? filteredItems
    : []

  activeFilterLabel.value = label || 'Alle Einträge'
}

function showVaultList() {
  selectedItem.value = null
  showForm.value = false
  editItem.value = null
}

function onDelete(id)      { items.value = items.value.filter(i => i.id !== id); selectedItem.value = null }
function onSaved(item)     {
  const idx = items.value.findIndex(i => i.id === item.id)
  if (idx >= 0) items.value[idx] = item
  else          items.value.push(item)
  selectedItem.value = item
  showForm.value     = false
  editItem.value     = null
}
function openNewForm()     { editItem.value = null; showForm.value = true; selectedItem.value = null }
function openEditForm(item){ editItem.value = item; showForm.value = true }
</script>

<style scoped>
.bw-app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.bw-session-restore {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--color-text-maxcontrast);
}

/* ── Zweispaltiges Layout ── */
.bw-layout {
  display:    flex;
  height:     100%;
  overflow:   hidden;
}

.bw-layout__sidebar {
  width:         320px;
  min-width:     280px;
  max-width:     380px;
  flex-shrink:   0;
  border-right:  1px solid var(--color-border);
  overflow:      hidden;
  display:       flex;
  flex-direction: column;
  background:    var(--color-navigation-bg, var(--color-main-background-translucent));
}

.bw-layout__items {
  width:         380px;
  min-width:     320px;
  max-width:     460px;
  flex-shrink:   0;
  overflow:      hidden;
  border-right:  1px solid var(--color-border);
  background:    var(--color-main-background);
}

.bw-layout__main {
  flex:           1;
  overflow-y:     auto;
  /* Hintergrund identisch zur Sidebar – einheitliches Erscheinungsbild */
  background:     var(--color-main-background);
  display:        flex;
  flex-direction: column;
}

/* ── Leerzustand Detailspalte ── */
.bw-main__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  padding: 2rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
}

.bw-main__empty h3,
.bw-main__empty p {
  margin: 0;
}

/* ── Lade-Zustand ── */
.bw-main__loading {
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  height:          100%;
  gap:             1rem;
  color:           var(--color-text-maxcontrast);
}
</style>
