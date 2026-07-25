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

    <div v-else class="bw-unlocked">
      <div
        v-if="showOrganizationNotice"
        class="bw-organization-notice"
      >
        <NcNoteCard type="warning">
          <div class="bw-organization-notice__content">
            <div>
              <strong>{{ organizationNoticeTitle }}</strong>
              <p>{{ organizationNoticeMessage }}</p>
            </div>

            <div
              v-if="organizationNotice.support_url || organizationNotice.support_email"
              class="bw-organization-notice__actions"
            >
              <NcButton
                v-if="organizationNotice.support_url"
                type="primary"
                :href="organizationNotice.support_url"
                target="_blank"
                rel="noopener noreferrer"
              >
                {{ organizationNoticeSupportLabel }}
              </NcButton>

              <NcButton
                v-if="organizationNotice.support_email"
                :href="organizationNoticeEmailHref"
              >
                {{ t('nc_bitwarden', 'Send email') }}
              </NcButton>
            </div>
          </div>
        </NcNoteCard>
      </div>

      <div class="bw-layout">
        <!-- Linke Sidebar: Vault-Liste -->
        <aside class="bw-layout__sidebar">
          <VaultList
            :key="vaultRevision"
            :items="items"
            :folders="folders"
            :collections="collections"
            :organizations="organizations"
            :selected-id="selectedItem?.id"
            :start-category="userPreferences.start_category"
            :navigation-start-mode="
              userPreferences.navigation_start_mode
            "
            @select="selectedItem = $event; showForm = false"
            @logout="logout"
            @generate-password="showPasswordGenerator = true"
            @settings="showWardenSettings = true"
            @filter-change="onFilterChange"
            @navigate="showVaultList"
            @create-folder="openFolderDialog()"
            @edit-folder="openFolderDialog($event)"
            @delete-folder="deleteFolder"
            @create-collection="openCollectionDialog()"
            @edit-collection="openCollectionDialog($event)"
            @delete-collection="deleteCollection"
            @drop-folder="moveItemsToFolder"
            @drop-collection="addItemsToCollection"
          />
        </aside>

        <!-- Mittlere Spalte: gefilterte Einträge -->
        <section class="bw-layout__items">
          <VaultItems
            :items="visibleItems"
            :title="activeFilterLabel"
            :selected-id="selectedItem?.id"
            :selection-revision="selectionRevision"

            :trash-mode="trashMode"

            @new="openNewForm"
            @select="
              selectedItem = $event;
              showForm = false;
              editItem = null
            "
            @edit="openEditForm"
            @delete="deleteItem"
            @duplicate="openDuplicateForm"
            @bulk-folder="openBulkAction('folder', $event)"
            @bulk-collections="
              openBulkAction('collections', $event)
            "
            @bulk-delete="deleteSelectedItems"

            @restore="restoreItem"
            @delete-permanent="
              deleteItemPermanently
            "
            @bulk-restore="
              restoreSelectedItems
            "
            @bulk-delete-permanent="
              deleteSelectedItemsPermanently
            "
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
            :folders="folders"
            :collections="collections"
            :organizations="organizations"
            :organization-keys="organizationKeys"
            :items="items"

            :trash-mode="trashMode"

            @changed="reloadVaultAndReset($event)"
            @delete="deleteItem"
            @edit="openEditForm"
            @duplicate="openDuplicateForm"
            @save-notes="saveInlineNotes"
            @select-related="openRelatedItem"

            @restore="restoreItem"
            @delete-permanent="
              deleteItemPermanently
            "
          />

          <ItemForm
            v-else-if="showForm"
            :item="editItem"
            :user-key="userKey"
            :folders="folders"
            :collections="collections"
            :organizations="organizations"
            :organization-keys="organizationKeys"
            :default-item-type="defaultItemType"
            :default-organization-id="defaultTarget.organizationId"
            :default-collection-id="defaultTarget.collectionId"

            :transfer-organization-id="
              dropTransferTarget.organizationId
            "
            :transfer-collection-id="
              dropTransferTarget.collectionId
            "
            :auto-save="dropTransferActive"

            :generator-preferences="userPreferences"
            @close="onItemFormClose"
            @attachments-changed="updateItemAttachments"
            @saved="onSaved"
            @auto-save-failed="onDropTransferFailed"
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
      :preferences="userPreferences"
      @close="showPasswordGenerator = false"
    />

    <WardenSettingsDialog
      v-if="showWardenSettings"
      :preferences="userPreferences"
      :user-key="userKey"
      :profile="vaultProfile"
      :organizations="organizations"
      :collections="collections"
      @close="showWardenSettings = false"
      @saved="onPreferencesSaved"
      @password-changed="onMasterPasswordChanged"
    />

    <BulkActionDialog
      v-if="bulkActionMode"
      :mode="bulkActionMode"
      :items="bulkActionItems"
      :folders="folders"
      :collections="collections"
      :organizations="organizations"
      @close="closeBulkAction"
      @apply="applyBulkAction"
    />
  </div>

  <ItemForm
    v-if="inlineNoteSaveItem"
    :item="inlineNoteSaveItem"
    :user-key="userKey"
    :folders="folders"
    :collections="collections"
    :organizations="organizations"
    :organization-keys="organizationKeys"
    :default-item-type="defaultItemType"
    :default-organization-id="
      defaultTarget.organizationId
    "
    :default-collection-id="
      defaultTarget.collectionId
    "
    :generator-preferences="userPreferences"
    headless
    auto-save
    @saved="onInlineNotesSaved"
    @auto-save-failed="onInlineNotesFailed"
  />
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { t } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcNoteCard from '@nextcloud/vue/components/NcNoteCard'
import LockOutlineIcon from 'vue-material-design-icons/LockOutline.vue'
import LoginForm from './components/LoginForm.vue'
import VaultList from './components/VaultList.vue'
import VaultItems from './components/VaultItems.vue'
import ItemDetail from './components/ItemDetail.vue'
import ItemForm from './components/ItemForm.vue'
import FolderDialog from './components/FolderDialog.vue'
import CollectionDialog from './components/CollectionDialog.vue'
import PasswordGeneratorDialog from './components/PasswordGeneratorDialog.vue'
import WardenSettingsDialog from './components/WardenSettingsDialog.vue'
import BulkActionDialog from './components/BulkActionDialog.vue'
import { VaultwardenApi } from './services/api.js'
import {
  DEFAULT_USER_PREFERENCES,
  normalizeUserPreferences,
} from './services/userPreferences.js'
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

const trashMode = ref(false)

const selectedItem = ref(null)
const loading = ref(false)
const showForm = ref(false)
const editItem = ref(null)

const inlineNoteSaveItem = ref(null)
const inlineNoteSaveCallbacks = ref(null)

const showFolderDialog = ref(false)
const editFolder = ref(null)
const showCollectionDialog = ref(false)
const editCollection = ref(null)
const showPasswordGenerator = ref(false)
const showWardenSettings = ref(false)
const bulkActionMode = ref('')
const bulkActionItems = ref([])
const selectionRevision = ref(0)

/*
 * Persönliche Einträge werden nacheinander mit der bereits
 * getesteten ItemForm-Transferlogik verarbeitet.
 */
const dropTransferQueue = ref([])

const dropTransferTarget = ref({
  organizationId: '',
  collectionId: '',
})

const dropTransferActive = computed(() => (
  dropTransferQueue.value.length > 0
  && Boolean(
    dropTransferTarget.value.organizationId,
  )
  && Boolean(
    dropTransferTarget.value.collectionId,
  )
))

const vaultProfile = ref({})
const userPreferences = ref(
  normalizeUserPreferences(DEFAULT_USER_PREFERENCES),
)

const organizationNoticeLoaded = ref(false)
const organizationNotice = ref({
  enabled: false,
  title: '',
  message: '',
  support_url: '',
  support_label: '',
  support_email: '',
})

const showOrganizationNotice = computed(() => (
  isLoggedIn.value
  && !loading.value
  && organizationNotice.value.enabled
  && organizations.value.length === 0
))

const organizationNoticeTitle = computed(() => (
  organizationNotice.value.title
  || t('nc_bitwarden', 'Not assigned to an organization yet')
))

const organizationNoticeMessage = computed(() => (
  organizationNotice.value.message
  || t(
    'nc_bitwarden',
    'Your personal vault is ready. Contact support so your account can be assigned to the correct organization.',
  )
))

const organizationNoticeSupportLabel = computed(() => (
  organizationNotice.value.support_label
  || t('nc_bitwarden', 'Contact support')
))

const organizationNoticeEmailHref = computed(() => (
  organizationNotice.value.support_email
    ? `mailto:${organizationNotice.value.support_email}`
    : ''
))

async function loadOrganizationNoticeSettings() {
  if (organizationNoticeLoaded.value) {
    return
  }

  try {
    const settings = await VaultwardenApi.getSettings()
    organizationNotice.value = {
      ...organizationNotice.value,
      ...(settings.organization_notice ?? {}),
    }

    userPreferences.value = normalizeUserPreferences(
      settings.preferences,
    )

  } catch (exception) {
    console.warn(
      '[nc_bitwarden] Organization notice settings could not be loaded:',
      exception,
    )
  } finally {
    organizationNoticeLoaded.value = true
  }
}

const defaultItemType = computed(() => {
  if (userPreferences.value.default_item_type === 'last_used') {
    return userPreferences.value.last_item_type
  }

  return Number(userPreferences.value.default_item_type) || 1
})

const defaultTarget = computed(() => {
  const mode = userPreferences.value.default_target_mode

  if (mode === 'personal') {
    return {
      organizationId: '',
      collectionId: '',
    }
  }

  const organizationId = mode === 'fixed'
    ? userPreferences.value.default_organization_id
    : userPreferences.value.last_organization_id

  const collectionId = mode === 'fixed'
    ? userPreferences.value.default_collection_id
    : userPreferences.value.last_collection_id

  const organizationExists = organizations.value.some(
    organization =>
      normalizeId(organization.id)
        === normalizeId(organizationId),
  )

  const collectionExists = collections.value.some(
    collection =>
      normalizeId(collection.id)
        === normalizeId(collectionId)
      && normalizeId(collection.organizationId)
        === normalizeId(organizationId)
      && !collection.readOnly,
  )

  if (!organizationExists || !collectionExists) {
    return {
      organizationId: '',
      collectionId: '',
    }
  }

  return {
    organizationId,
    collectionId,
  }
})

async function onPreferencesSaved(preferences) {
  userPreferences.value = normalizeUserPreferences(
    preferences,
  )

}

function onMasterPasswordChanged() {
  showWardenSettings.value = false
  logout()
}

async function onLoggedIn({
  masterKey,
  keepUnlocked = true,
}) {
  await loadOrganizationNoticeSettings()

  userKey.value = masterKey
  vaultRevision.value += 1
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

    vaultProfile.value = {
      ...(sync.Profile ?? {}),
      UserDecryption: sync.UserDecryption ?? {},
    }

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
  showWardenSettings.value = false

  dropTransferQueue.value = []
  dropTransferTarget.value = {
    organizationId: '',
    collectionId: '',
  }

  vaultProfile.value = {}
}

function logout() {
  clearSessionKey()
  resetVaultState()
}

onMounted(async () => {
  try {
    await loadOrganizationNoticeSettings()
    const restoredKey = restoreSessionKey()

    if (!restoredKey) {
      return
    }

    userKey.value = restoredKey
    vaultRevision.value += 1
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

function updateItemAttachments(payload) {
  const cipherId = normalizeId(payload?.cipherId)
  const attachments = [
    ...(payload?.attachments ?? []),
  ]

  if (!cipherId) {
    return
  }

  const update = item => (
    normalizeId(item?.id) === cipherId
      ? {
        ...item,
        attachments,
      }
      : item
  )

  items.value = items.value.map(update)
  visibleItems.value = visibleItems.value.map(update)

  if (
    normalizeId(selectedItem.value?.id) === cipherId
  ) {
    selectedItem.value = update(selectedItem.value)
  }

  if (
    normalizeId(editItem.value?.id) === cipherId
  ) {
    editItem.value = update(editItem.value)
  }
}

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

function onFilterChange({
  items: filteredItems,
  label,
  trash = false,
}) {
  visibleItems.value = Array.isArray(filteredItems)
    ? filteredItems
    : []

  activeFilterLabel.value = label
    || t('nc_bitwarden', 'All items')

  trashMode.value = Boolean(trash)
}

function openRelatedItem(candidate) {
  const candidateId = normalizeId(candidate?.id)

  if (!candidateId) {
    return
  }

  const matchingItem = items.value.find(item =>
    normalizeId(item.id) === candidateId,
  )

  if (!matchingItem) {
    return
  }

  selectedItem.value = matchingItem
  showForm.value = false
  editItem.value = null
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

function itemsForIds(itemIds) {
  const ids = new Set(
    (itemIds ?? []).map(normalizeId),
  )

  return items.value.filter(item =>
    ids.has(normalizeId(item.id)),
  )
}

function closeBulkAction() {
  bulkActionMode.value = ''
  bulkActionItems.value = []
}

function resetBulkSelection() {
  selectionRevision.value += 1
}

function openBulkAction(mode, selectedItems) {
  const candidates = Array.isArray(selectedItems)
    ? selectedItems
    : []

  if (!candidates.length) {
    return
  }

  // Die genaue Prüfung erfolgt im Dialog. Dadurch dürfen
  // auch persönliche Einträge eine Zielorganisation wählen.
  bulkActionMode.value = mode
  bulkActionItems.value = [...candidates]
}

async function applyBulkAction(payload) {
  const selected = itemsForIds(payload?.itemIds)

  if (!selected.length) {
    closeBulkAction()
    resetBulkSelection()
    return
  }

  try {
    if (payload.mode === 'folder') {
      for (const item of selected) {
        await VaultwardenApi.updateCipherPartial(
          item.id,
          {
            folderId: payload.folderId,
            favorite: Boolean(item.favorite),
          },
        )
      }
    } else if (payload.mode === 'collections') {
      if (payload.transferCollectionId) {
        const targetCollection =
          collections.value.find(collection =>
            normalizeId(collection.id)
              === normalizeId(
                payload.transferCollectionId,
              ),
          )

        if (!targetCollection) {
          throw new Error(
            t(
              'nc_bitwarden',
              'The selected target collection no longer exists.',
            ),
          )
        }

        /*
         * Der Dialog wird vor dem Start geschlossen.
         * addItemsToCollection verwendet anschließend dieselbe
         * getestete Transferwarteschlange wie Drag-and-drop.
         */
        closeBulkAction()

        await addItemsToCollection({
          itemIds: selected.map(item => item.id),
          collection: targetCollection,
        })

        return
      }

      for (const item of selected) {
        await VaultwardenApi.updateCipherCollections(
          item.id,
          payload.collectionIds ?? [],
        )
      }
    }

    closeBulkAction()
    resetBulkSelection()
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Bulk action failed:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The bulk action could not be completed.',
      ),
    )
  }
}

async function moveItemsToFolder({
  itemIds,
  folderId,
}) {
  const selected = itemsForIds(itemIds)

  if (
    !selected.length
    || selected.some(item =>
      normalizeId(item.organizationId) !== null,
    )
  ) {
    // Organisationsobjekte dürfen nicht in persönliche Ordner.
    // Ungültige Drag-and-drop-Ziele werden bewusst still ignoriert.
    return
  }

  try {
    for (const item of selected) {
      await VaultwardenApi.updateCipherPartial(
        item.id,
        {
          folderId,
          favorite: Boolean(item.favorite),
        },
      )
    }

    resetBulkSelection()
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Drag-and-drop folder move failed:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The items could not be moved to the folder.',
      ),
    )
  }
}

function clearDropTransfer() {
  dropTransferQueue.value = []

  dropTransferTarget.value = {
    organizationId: '',
    collectionId: '',
  }
}

function startNextDropTransfer() {
  const nextId = dropTransferQueue.value[0]

  if (!nextId) {
    clearDropTransfer()
    return
  }

  const nextItem = items.value.find(item =>
    normalizeId(item.id) === normalizeId(nextId),
  )

  if (!nextItem) {
    throw new Error(
      'Der nächste persönliche Eintrag wurde '
        + 'im Tresor nicht gefunden.',
    )
  }

  editItem.value = nextItem
  selectedItem.value = null
  showForm.value = true
}

function onItemFormClose() {
  if (dropTransferActive.value) {
    clearDropTransfer()
    resetBulkSelection()
  }

  showForm.value = false
  editItem.value = null
}

async function onDropTransferFailed(exception) {
  const failedId = dropTransferQueue.value[0]

  const failedItem = items.value.find(item =>
    normalizeId(item.id) === normalizeId(failedId),
  )

  const itemName =
    failedItem?.name
    || 'Unbenannt'

  clearDropTransfer()
  resetBulkSelection()

  await reloadVaultAndReset()

  alert(
    `Eintrag „${itemName}“ konnte nicht `
      + 'in die Sammlung verschoben werden.\n\n'
      + (
        exception?.response?.data?.error
        || exception?.response?.data?.message
        || exception?.message
        || 'Unbekannter Fehler'
      ),
  )
}

async function addItemsToCollection({
  itemIds,
  collection,
}) {
  const selected = itemsForIds(itemIds)

  if (!selected.length || !collection?.id) {
    return
  }

  const targetOrganizationId = normalizeId(
    collection.organizationId,
  )

  if (!targetOrganizationId) {
    return
  }

  /*
   * Einträge anderer Organisationen dürfen nicht durch
   * versehentliches Drag-and-drop übertragen werden.
   */
  const foreignItems = selected.filter(item => {
    const itemOrganizationId = normalizeId(
      item.organizationId,
    )

    return (
      itemOrganizationId !== null
      && itemOrganizationId
        !== targetOrganizationId
    )
  })

  if (foreignItems.length > 0) {
    return
  }

  const personalItems = selected.filter(item =>
    normalizeId(item.organizationId) === null,
  )

  const organizationItems = selected.filter(item =>
    normalizeId(item.organizationId)
      === targetOrganizationId,
  )

  if (personalItems.length > 0) {
    const organization =
      organizationForId(
        collection.organizationId,
      )

    const organizationName =
      organization?.name
      || collection.organizationId

    const collectionName =
      collection.path
      || collection.name
      || collection.label
      || collection.id

    const message =
      personalItems.length === 1
        ? (
          `Der persönliche Eintrag „${
            personalItems[0].name || 'Unbenannt'
          }“ wird in die Organisation `
            + `„${organizationName}“ verschoben und `
            + `der Sammlung „${collectionName}“ `
            + 'zugeordnet.\n\n'
            + 'Berechtigte Mitglieder erhalten Zugriff '
            + 'auf den gesamten Eintrag einschließlich '
            + 'Passkeys und Anhängen.\n\n'
            + 'Fortfahren?'
        )
        : (
          `${personalItems.length} persönliche `
            + 'Einträge werden in die Organisation '
            + `„${organizationName}“ verschoben und `
            + `der Sammlung „${collectionName}“ `
            + 'zugeordnet.\n\n'
            + 'Berechtigte Mitglieder erhalten Zugriff '
            + 'auf die gesamten Einträge einschließlich '
            + 'Passkeys und Anhängen.\n\n'
            + 'Fortfahren?'
        )

    if (!confirm(message)) {
      return
    }
  }

  try {
    /*
     * Einträge, die schon zur Zielorganisation gehören,
     * erhalten lediglich die zusätzliche Sammlung.
     */
    for (const item of organizationItems) {
      const collectionIds = [
        ...new Set([
          ...(item.collectionIds ?? []),
          collection.id,
        ]),
      ]

      await VaultwardenApi.updateCipherCollections(
        item.id,
        collectionIds,
      )
    }

    if (personalItems.length === 0) {
      resetBulkSelection()
      await reloadVaultAndReset()
      return
    }

    /*
     * Die persönlichen Einträge werden nacheinander durch das
     * bestehende ItemForm übertragen. Dieses übernimmt bereits:
     *
     * - Neuverschlüsselung für die Organisation
     * - Passkeys
     * - Anhänge
     * - Rollback bei Fehlern
     */
    dropTransferQueue.value =
      personalItems.map(item => item.id)

    dropTransferTarget.value = {
      organizationId:
        collection.organizationId,

      collectionId:
        collection.id,
    }

    resetBulkSelection()
    startNextDropTransfer()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Drag-and-drop collection '
        + 'assignment failed:',
      exception,
    )

    clearDropTransfer()
    resetBulkSelection()

    await reloadVaultAndReset()

    alert(
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || 'Die Einträge konnten nicht in die '
        + 'Sammlung verschoben werden.',
    )
  }
}

async function deleteSelectedItems(selectedItems) {
  const candidates = Array.isArray(selectedItems)
    ? selectedItems
    : []

  if (!candidates.length) {
    return
  }

  if (
    !confirm(
      t(
        'nc_bitwarden',
        'Move {count} selected items to trash?',
        { count: candidates.length },
      ),
    )
  ) {
    return
  }

  try {
    for (const item of candidates) {
      await VaultwardenApi.trashCipher(item.id)
    }

    resetBulkSelection()
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Selected items could not be moved to trash:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The selected items could not be moved to the trash.',
      ),
    )
  }
}

async function restoreItem(item) {
  if (!item?.id) {
    return
  }

  try {
    await VaultwardenApi.restoreCipher(item.id)
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Item could not be restored:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The item could not be restored.',
      ),
    )
  }
}

async function restoreSelectedItems(
  selectedItems,
) {
  const candidates = Array.isArray(selectedItems)
    ? selectedItems
    : []

  if (!candidates.length) {
    return
  }

  if (
    !confirm(
      t(
        'nc_bitwarden',
        'Restore {count} selected items?',
        {
          count: candidates.length,
        },
      ),
    )
  ) {
    return
  }

  try {
    for (const item of candidates) {
      await VaultwardenApi.restoreCipher(
        item.id,
      )
    }

    resetBulkSelection()
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Selected items '
        + 'could not be restored:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The selected items could not be restored.',
      ),
    )
  }
}

async function deleteItemPermanently(item) {
  if (!item?.id) {
    return
  }

  if (
    !confirm(
      t(
        'nc_bitwarden',
        'Permanently delete item {name}? This cannot be undone.',
        {
          name:
            item.name
            || t(
              'nc_bitwarden',
              '(no name)',
            ),
        },
      ),
    )
  ) {
    return
  }

  try {
    await VaultwardenApi.deleteCipher(item.id)
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Item could not be '
        + 'permanently deleted:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The item could not be permanently deleted.',
      ),
    )
  }
}

async function deleteSelectedItemsPermanently(
  selectedItems,
) {
  const candidates = Array.isArray(selectedItems)
    ? selectedItems
    : []

  if (!candidates.length) {
    return
  }

  if (
    !confirm(
      t(
        'nc_bitwarden',
        'Permanently delete {count} selected items? This cannot be undone.',
        {
          count: candidates.length,
        },
      ),
    )
  ) {
    return
  }

  try {
    for (const item of candidates) {
      await VaultwardenApi.deleteCipher(
        item.id,
      )
    }

    resetBulkSelection()
    await reloadVaultAndReset()
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Selected items could '
        + 'not be permanently deleted:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || exception?.response?.data?.message
      || exception?.message
      || t(
        'nc_bitwarden',
        'The selected items could not be permanently deleted.',
      ),
    )
  }
}

function cloneItemForDraft(item) {
  const clone = typeof structuredClone === 'function'
    ? structuredClone(item)
    : JSON.parse(JSON.stringify(item))

  delete clone.id
  delete clone.revisionDate
  delete clone.passwordRevisionDate
  delete clone.passwordHistory

  clone.name = t(
    'nc_bitwarden',
    'Copy of {name}',
    {
      name: item.name
        || t('nc_bitwarden', '(no name)'),
    },
  )

  return clone
}

function openDuplicateForm(item) {
  editItem.value = cloneItemForDraft(item)
  showForm.value = true
  selectedItem.value = null
}

async function deleteItem(item) {
  if (!confirm(
    t(
      'nc_bitwarden',
      'Move item {name} to trash?',
      { name: item.name },
    ),
  )) {
    return
  }

  try {
    await VaultwardenApi.trashCipher(item.id)
    onDelete(item.id)
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Item could not be moved to trash:',
      exception,
    )

    alert(
      exception?.response?.data?.error
      || t(
        'nc_bitwarden',
        'The item could not be moved to the trash.',
      ),
    )
  }
}

async function onDelete() {
  await reloadVaultAndReset()
}

function saveInlineNotes(request) {
  if (
    !request?.item?.id
    || typeof request.notes !== 'string'
  ) {
    request?.reject?.(
      new Error(
        'Ungültige Notiz-Speicheranfrage.',
      ),
    )
    return
  }

  if (inlineNoteSaveItem.value) {
    request?.reject?.(
      new Error(
        'Eine Notiz wird bereits gespeichert.',
      ),
    )
    return
  }

  inlineNoteSaveCallbacks.value = {
    resolve: request.resolve,
    reject: request.reject,
  }

  inlineNoteSaveItem.value = {
    ...request.item,
    notes: request.notes,
  }
}

async function onInlineNotesSaved(payload) {
  const callbacks =
    inlineNoteSaveCallbacks.value

  const updatedItem =
    payload?.item ?? payload

  inlineNoteSaveItem.value = null
  inlineNoteSaveCallbacks.value = null

  /*
   * Editor sofort schließen. Danach wird der Tresor neu geladen.
   */
  callbacks?.resolve?.(updatedItem)

  try {
    await onSaved(payload)
  } catch (exception) {
    console.error(
      '[nc_bitwarden] Inline notes reload failed:',
      exception,
    )
  }
}

function onInlineNotesFailed(exception) {
  const callbacks =
    inlineNoteSaveCallbacks.value

  inlineNoteSaveItem.value = null
  inlineNoteSaveCallbacks.value = null

  callbacks?.reject?.(exception)
}

async function onSaved(payload) {
  const item = payload?.item ?? payload
  const created = payload?.created === true

  const wasDropTransfer =
    dropTransferActive.value

  if (wasDropTransfer) {
    dropTransferQueue.value.shift()
  }

  if (created && item) {
    const nextPreferences = normalizeUserPreferences({
      ...userPreferences.value,
      last_item_type: Number(item.type) || 1,
      last_organization_id: item.organizationId ?? '',
      last_collection_id: item.collectionIds?.[0] ?? '',
    })

    userPreferences.value = nextPreferences

    try {
      await VaultwardenApi.savePreferences(
        nextPreferences,
      )
    } catch (exception) {
      console.warn(
        '[nc_bitwarden] Last used item defaults could not be saved:',
        exception,
      )
    }
  }

  await reloadVaultAndReset(
    wasDropTransfer
      ? null
      : item?.id ?? null,
  )

  if (wasDropTransfer) {
    if (dropTransferQueue.value.length > 0) {
      try {
        startNextDropTransfer()
      } catch (exception) {
        await onDropTransferFailed(exception)
      }
    } else {
      clearDropTransfer()
      resetBulkSelection()
    }
  }
}

function openNewForm() {
  closeBulkAction()
  editItem.value = null
  showForm.value = true
  selectedItem.value = null
}

function openEditForm(item) {
  if (item?.deletedDate) {
    return
  }

  closeBulkAction()
  editItem.value = item
  showForm.value = true
}
</script>

<style scoped>
.bw-unlocked {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}

.bw-unlocked > .bw-layout {
  flex: 1;
  min-height: 0;
  height: auto;
}

.bw-organization-notice {
  padding: 0.75rem 1rem 0;
  background: var(--color-main-background);
}

.bw-organization-notice__content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.bw-organization-notice__content p {
  margin: 0.35rem 0 0;
}

.bw-organization-notice__actions {
  display: flex;
  flex: 0 0 auto;
  gap: 0.5rem;
}

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
  flex:       1;
  min-height: 0;
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
