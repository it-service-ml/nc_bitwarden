<template>
  <div class="bw-app">
    <div v-if="restoringSession" class="bw-session-restore">
      <NcLoadingIcon :size="48" />
      <p>{{ t('nc_bitwarden', 'Restoring vault session…') }}</p>
    </div>

    <LoginForm
      v-else-if="!isLoggedIn"
      @logged-in="onLoggedIn"
    />

    <div v-else class="bw-layout">
      <!-- Linke Sidebar: Vault-Liste -->
      <aside class="bw-layout__sidebar">
        <VaultList
          :key="vaultRevision"
          :items="items"
          :folders="folders"
          :collections="collections"
          :organizations="organizations"
          :selected-id="selectedItem?.id"
          @select="selectedItem = $event; showForm = false"
          @logout="logout"
          @generate-password="showPasswordGenerator = true"
          @filter-change="onFilterChange"
          @navigate="showVaultList"
          @create-folder="openFolderDialog()"
          @edit-folder="openFolderDialog($event)"
          @delete-folder="deleteFolder"
          @create-collection="openCollectionDialog()"
          @edit-collection="openCollectionDialog($event)"
          @delete-collection="deleteCollection"
        />
      </aside>

      <!-- Mittlere Spalte: gefilterte Einträge -->
      <section class="bw-layout__items">
        <VaultItems
          :items="visibleItems"
          :title="activeFilterLabel"
          :selected-id="selectedItem?.id"
          @new="openNewForm"
          @select="
            selectedItem = $event;
            showForm = false;
            editItem = null
          "
          @edit="openEditForm"
          @delete="deleteItem"
        />
      </section>

      <!-- Rechte Spalte: Detailansicht oder Formular -->
      <main class="bw-layout__main">
        <div v-if="loading" class="bw-main__loading">
          <NcLoadingIcon :size="48" />
          <p>{{ t('nc_bitwarden', 'Decrypting vault…') }}</p>
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
          :collections="collections"
          :organizations="organizations"
          :organization-keys="organizationKeys"
          @close="showForm = false; editItem = null"
          @saved="onSaved"
        />

        <div v-else class="bw-main__empty">
          <LockOutlineIcon :size="56" />
          <h3>{{ t('nc_bitwarden', 'Vault unlocked') }}</h3>
          <p>
            {{ t(
              'nc_bitwarden',
              'Select an item from the middle column.',
            ) }}
          </p>
        </div>
      </main>
    </div>

    <FolderDialog
      v-if="showFolderDialog"
      :folder="editFolder"
      :user-key="userKey"
      @close="closeFolderDialog"
      @saved="onFolderSaved"
    />

    <CollectionDialog
      v-if="showCollectionDialog"
      :collection="editCollection"
      :collections="collections"
      :organizations="organizations"
      :organization-keys="organizationKeys"
      @close="closeCollectionDialog"
      @saved="onCollectionSaved"
    />

    <PasswordGeneratorDialog
      v-if="showPasswordGenerator"
      @close="showPasswordGenerator = false"
    />
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import LockOutlineIcon from 'vue-material-design-icons/LockOutline.vue'
import LoginForm from './components/LoginForm.vue'
import VaultList from './components/VaultList.vue'
import VaultItems from './components/VaultItems.vue'
import ItemDetail from './components/ItemDetail.vue'
import ItemForm from './components/ItemForm.vue'
import FolderDialog from './components/FolderDialog.vue'
import CollectionDialog from './components/CollectionDialog.vue'
import PasswordGeneratorDialog from './components/PasswordGeneratorDialog.vue'
import { VaultwardenApi } from './services/api.js'
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
  if (o !== null && typeof o === 'object') { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k[0].toUpperCase() + k.slice(1), toPascal(v)])) }
  return o
}

const restoringSession = ref(true)
const isLoggedIn = ref(false)
const vaultRevision = ref(0)
const userKey = ref(null)
const items = ref([])
const folders = ref([])
const collections = ref([])
const organizations = ref([])
const organizationKeys = ref({})
const visibleItems = ref([])
const activeFilterLabel = ref(
  t('nc_bitwarden', 'All items'),
)
const selectedItem = ref(null)
const loading = ref(false)
const showForm = ref(false)
const editItem = ref(null)
const showFolderDialog = ref(false)
const editFolder = ref(null)
const showCollectionDialog = ref(false)
const editCollection = ref(null)
const showPasswordGenerator = ref(false)

async function onLoggedIn({ masterKey, keepUnlocked = true }) {
  userKey.value = masterKey
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
    const sync = toPascal(await VaultwardenApi.sync())

    // Org-Keys via RSA entschlüsseln
    let orgKeys = {}
    const orgs = sync.Profile?.Organizations ?? []

    organizations.value = orgs.map(org => ({
      id: org.Id,
      name: org.Name || org.Identifier || org.Id,
      type: Number(org.Type),
      accessAll: Boolean(org.AccessAll),
      permissions: org.Permissions ?? {},
      canCreateCollections: canCreateCollectionsForOrg(org),
    }))

    if (sync.Profile?.PrivateKey && orgs.length > 0) {
      try {
        const rsaKey = await decryptRsaPrivateKey(sync.Profile.PrivateKey, userKey.value)
        orgKeys = await decryptOrgKeys(orgs, rsaKey)
        console.info(`[nc_bitwarden] ${Object.keys(orgKeys).length}/${orgs.length} Org-Keys entschlüsselt`)
      } catch (e) {
        console.warn('[nc_bitwarden] Org-Key Entschlüsselung fehlgeschlagen:', e.message)
      }
    }

    organizationKeys.value = orgKeys

    // Ordner
    const folderResults = await Promise.allSettled(
      (sync.Folders ?? []).map(async f => ({
        id: f.Id,
        name: await decryptEncString(f.Name, userKey.value.encKey, userKey.value.macKey),
      })),
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
            `Kein Organisationsschlüssel für Sammlung ${collection.Id}`,
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
      }),
    )

    const failedCollections = collectionResults
      .filter(result => result.status === 'rejected')

    if (failedCollections.length > 0) {
      console.warn(
        `[nc_bitwarden] ${failedCollections.length} Sammlungen konnten nicht entschlüsselt werden`,
      )
    }

    collections.value = collectionResults
      .filter(result => result.status === 'fulfilled')
      .map(result => decorateCollection(result.value))

    // Ciphers – ein Fehler killt nicht alle anderen
    const cipherResults = await Promise.allSettled(
      (sync.Ciphers ?? []).map(c => decryptCipher(c, userKey.value, orgKeys)),
    )
    const failed = cipherResults.filter(r => r.status === 'rejected').length
    if (failed > 0) console.warn(`[nc_bitwarden] ${failed} Einträge konnten nicht entschlüsselt werden`)
    items.value = cipherResults
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)

    visibleItems.value = [...items.value]
    activeFilterLabel.value = t('nc_bitwarden', 'All items')
    vaultRevision.value += 1

    console.info(
      `[nc_bitwarden] Vault geladen: ${items.value.length} Einträge, `
      + `${folders.value.length} Ordner, ${collections.value.length} Sammlungen`,
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
  organizations.value = []
  organizationKeys.value = {}
  visibleItems.value = []
  activeFilterLabel.value = t('nc_bitwarden', 'All items')
  selectedItem.value = null
  showForm.value = false
  editItem.value = null
  showFolderDialog.value = false
  editFolder.value = null
  showCollectionDialog.value = false
  editCollection.value = null
  showPasswordGenerator.value = false
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

async function reloadVaultAndReset(selectedId = null) {
  const loaded = await loadVault()

  if (!loaded) {
    clearSessionKey()
    resetVaultState()
    return false
  }

  showForm.value = false
  editItem.value = null

  const normalizedSelectedId = normalizeId(selectedId)

  selectedItem.value = normalizedSelectedId
    ? items.value.find(item =>
      normalizeId(item.id) === normalizedSelectedId,
    ) ?? null
    : null

  return true
}

function onFilterChange({ items: filteredItems, label }) {
  visibleItems.value = Array.isArray(filteredItems)
    ? filteredItems
    : []

  activeFilterLabel.value = label
    || t('nc_bitwarden', 'All items')
}

function showVaultList() {
  selectedItem.value = null
  showForm.value = false
  editItem.value = null
}

function normalizeId(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value).trim().toLowerCase()
}

function canCreateCollectionsForOrg(org) {
  const type = Number(org.Type ?? org.type)
  const permissions = org.Permissions ?? org.permissions ?? {}

  return (
    type === 0
    || type === 1
    || (
      (type === 3 || type === 4)
      && (
        Boolean(org.AccessAll ?? org.accessAll)
        || Boolean(
          permissions.CreateNewCollections
          ?? permissions.createNewCollections,
        )
      )
    )
  )
}

function organizationForId(organizationId) {
  return organizations.value.find(org =>
    normalizeId(org.id) === normalizeId(organizationId),
  )
}

function decorateCollection(collection) {
  const organization = organizationForId(collection.organizationId)
  const type = Number(organization?.type)
  const permissions = organization?.permissions ?? {}

  const ownerOrAdmin = type === 0 || type === 1

  return {
    ...collection,
    canManage:
      ownerOrAdmin
      || Boolean(collection.manage)
      || Boolean(
        permissions.EditAnyCollection
        ?? permissions.editAnyCollection,
      ),
    canDelete:
      ownerOrAdmin
      || Boolean(collection.manage)
      || Boolean(
        permissions.DeleteAnyCollection
        ?? permissions.deleteAnyCollection,
      ),
  }
}

function collectionDescendants(collection) {
  const prefix = `${String(collection.name).replace(/\/+$/, '')}/`

  return collections.value.filter(candidate =>
    normalizeId(candidate.organizationId)
      === normalizeId(collection.organizationId)
    && normalizeId(candidate.id) !== normalizeId(collection.id)
    && String(candidate.name).startsWith(prefix),
  )
}

function openFolderDialog(folder = null) {
  editFolder.value = folder
  showFolderDialog.value = true
}

function closeFolderDialog() {
  showFolderDialog.value = false
  editFolder.value = null
}

async function onFolderSaved() {
  closeFolderDialog()
  await reloadVaultAndReset()
}

async function deleteFolder(folder) {
  const count = items.value.filter(item =>
    normalizeId(item.folderId) === normalizeId(folder.id),
  ).length

  const folderPrompt = t(
    'nc_bitwarden',
    'Really delete folder {name}?',
    { name: folder.name },
  )

  const message = count > 0
    ? [
      folderPrompt,
      t(
        'nc_bitwarden',
        '{count} entries will then be shown without a personal folder.',
        { count },
      ),
    ].join('\n\n')
    : folderPrompt

  if (!confirm(message)) {
    return
  }

  try {
    await VaultwardenApi.deleteFolder(folder.id)

    folders.value = folders.value.filter(candidate =>
      normalizeId(candidate.id) !== normalizeId(folder.id),
    )

    items.value = items.value.map(item =>
      normalizeId(item.folderId) === normalizeId(folder.id)
        ? { ...item, folderId: null }
        : item,
    )

    if (
      selectedItem.value
      && normalizeId(selectedItem.value.folderId) === normalizeId(folder.id)
    ) {
      selectedItem.value = {
        ...selectedItem.value,
        folderId: null,
      }
    }

    await reloadVaultAndReset()
  } catch (exception) {
    console.error('[nc_bitwarden] Ordner konnte nicht gelöscht werden:', exception)
    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The folder could not be deleted.',
      ),
    )
  }
}

function openCollectionDialog(collection = null) {
  editCollection.value = collection
  showCollectionDialog.value = true
}

function closeCollectionDialog() {
  showCollectionDialog.value = false
  editCollection.value = null
}

async function onCollectionSaved() {
  closeCollectionDialog()
  await reloadVaultAndReset()
}

async function deleteCollection(collection) {
  const descendants = collectionDescendants(collection)

  if (descendants.length > 0) {
    alert(
      t(
        'nc_bitwarden',
        'This collection has {count} subcollections and therefore cannot be deleted yet.',
        { count: descendants.length },
      ),
    )
    return
  }

  const affectedItems = items.value.filter(item =>
    (item.collectionIds ?? []).some(collectionId =>
      normalizeId(collectionId) === normalizeId(collection.id),
    ),
  ).length

  const collectionPrompt = t(
    'nc_bitwarden',
    'Really delete collection {name}?',
    { name: collection.name },
  )

  const message = affectedItems > 0
    ? [
      collectionPrompt,
      t(
        'nc_bitwarden',
        '{count} entries will be kept. Only their assignment to this collection will be removed.',
        { count: affectedItems },
      ),
    ].join('\n\n')
    : collectionPrompt

  if (!confirm(message)) {
    return
  }

  try {
    await VaultwardenApi.deleteCollection(
      collection.organizationId,
      collection.id,
    )

    collections.value = collections.value.filter(candidate =>
      normalizeId(candidate.id) !== normalizeId(collection.id),
    )

    items.value = items.value.map(item => ({
      ...item,
      collectionIds: (item.collectionIds ?? []).filter(collectionId =>
        normalizeId(collectionId) !== normalizeId(collection.id),
      ),
    }))

    if (selectedItem.value) {
      selectedItem.value = {
        ...selectedItem.value,
        collectionIds:
          (selectedItem.value.collectionIds ?? [])
            .filter(collectionId =>
              normalizeId(collectionId) !== normalizeId(collection.id),
            ),
      }
    }

    // Nach dem Löschen darf kein Filter auf der nicht mehr existierenden
    // Sammlung verbleiben.
    visibleItems.value = [...items.value]
    activeFilterLabel.value = t('nc_bitwarden', 'All items')

    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Sammlung konnte nicht gelöscht werden:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The collection could not be deleted.',
      ),
    )
  }
}

async function deleteItem(item) {
  if (!confirm(
    t(
      'nc_bitwarden',
      'Really delete item {name}?',
      { name: item.name },
    ),
  )) {
    return
  }

  try {
    await VaultwardenApi.deleteCipher(item.id)
    onDelete(item.id)
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Eintrag konnte nicht gelöscht werden:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The item could not be deleted.',
      ),
    )
  }
}

async function onDelete() {
  await reloadVaultAndReset()
}

async function onSaved(item) {
  await reloadVaultAndReset(item.id)
}

function openNewForm() { editItem.value = null; showForm.value = true; selectedItem.value = null }
function openEditForm(item) { editItem.value = item; showForm.value = true }
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

/* ── Dreispaltiges Layout ── */
.bw-layout {
  display:    flex;
  height:     100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.bw-layout__sidebar {
  width:         400px;
  min-width:     400px;
  max-width:     400px;
  flex-shrink:   0;
  border-right:  1px solid var(--color-border);
  overflow:      hidden;
  display:       flex;
  flex-direction: column;
  background:    var(--color-navigation-bg, var(--color-main-background-translucent));
}

.bw-layout__items {
  width:         400px;
  min-width:     400px;
  max-width:     400px;
  flex-shrink:   0;
  overflow:      hidden;
  border-right:  1px solid var(--color-border);
  background:    var(--color-main-background);
}

.bw-layout__main {
  min-width:      480px;
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
