<template>
  <div class="bw-vault">
    <!-- Suchleiste -->
    <div class="bw-vault__search">
      <NcTextField v-model="search" :label="t('Suchen...')" />
    </div>

    <!-- Sortierung -->
    <div class="bw-vault__sort">
      <label for="bw-vault-sort">Sortierung</label>
      <select id="bw-vault-sort" v-model="sortMode">
        <option value="name-asc">Name A–Z</option>
        <option value="name-desc">Name Z–A</option>
        <option value="favorites">Favoriten zuerst</option>
        <option value="modified-desc">Zuletzt geändert</option>
        <option value="modified-asc">Älteste zuerst</option>
      </select>
    </div>

    <div class="bw-vault__navigation">
      <!-- Kategorien -->
      <div class="bw-vault__folders">
      <div class="bw-vault__section-title">Kategorien</div>

      <button
        v-for="category in categories"
        :key="category.id"
        class="bw-folder"
        :class="{ 'bw-folder--active':
          selectedCategory === category.id
          && selectedFolder === null
          && selectedCollection === null
        }"
        @click="selectCategory(category.id)"
      >
        <component
          :is="category.icon"
          :size="17"
          class="bw-folder__icon"
        />
        {{ category.label }}
        <span class="bw-folder__count">{{ categoryCount(category.id) }}</span>
      </button>
    </div>

    <!-- Ordner -->
    <div class="bw-vault__folders">
      <div class="bw-vault__section-heading">
        <div class="bw-vault__section-title">Ordner</div>

        <button
          type="button"
          class="bw-vault__section-action"
          title="Neuen persönlichen Ordner erstellen"
          aria-label="Neuen persönlichen Ordner erstellen"
          @click="$emit('create-folder')"
        >
          <PlusIcon :size="18" />
        </button>
      </div>

      <button
        class="bw-folder"
        :class="{ 'bw-folder--active': selectedFolder === '__none__' }"
        @click="selectFolder('__none__')"
      >
        <FolderOutlineIcon :size="17" class="bw-folder__icon" />
        Ohne persönlichen Ordner
        <span class="bw-folder__count">{{ folderCount(null) }}</span>
      </button>

      <div
        v-for="folder in sortedFolders"
        :key="folder.id"
        class="bw-folder-row"
        :class="{
          'bw-folder-row--active':
            selectedFolder === normalizeId(folder.id),
        }"
      >
        <button
          type="button"
          class="bw-folder bw-folder--main"
          @click="selectFolder(folder.id)"
        >
          <FolderOutlineIcon
            :size="17"
            class="bw-folder__icon"
          />

          <span class="bw-folder__name">
            {{ folder.name }}
          </span>

          <span class="bw-folder__count">
            {{ folderCount(folder.id) }}
          </span>
        </button>

        <div class="bw-folder-row__actions">
          <button
            type="button"
            class="bw-folder-row__action"
            :title="`Ordner ${folder.name} umbenennen`"
            :aria-label="`Ordner ${folder.name} umbenennen`"
            @click.stop="$emit('edit-folder', folder)"
          >
            <PencilOutlineIcon :size="16" />
          </button>

          <button
            type="button"
            class="bw-folder-row__action"
            :title="`Ordner ${folder.name} löschen`"
            :aria-label="`Ordner ${folder.name} löschen`"
            @click.stop="$emit('delete-folder', folder)"
          >
            <DeleteOutlineIcon :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- Organisation-Sammlungen -->
    <div v-if="collectionRows.length > 0" class="bw-vault__folders">
      <div class="bw-vault__section-title">Sammlungen</div>

      <button
        v-for="collection in collectionRows"
        :key="collection.id"
        class="bw-folder bw-collection"
        :class="{ 'bw-folder--active':
          selectedCollection === normalizeId(collection.id)
        }"
        :style="{
          paddingLeft: `${0.75 + collection.depth * 1.1}rem`,
        }"
        :title="collection.path"
        @click="selectCollection(collection.id)"
      >
        <span
          class="bw-collection__toggle"
          :class="{ 'bw-collection__toggle--empty': !collection.hasChildren }"
          @click.stop="toggleCollection(collection)"
        >
          <ChevronRightIcon
            v-if="collection.hasChildren && isCollectionCollapsed(collection)"
            :size="17"
          />
          <ChevronDownIcon
            v-else-if="collection.hasChildren"
            :size="17"
          />
        </span>

        <ArchiveOutlineIcon
          :size="17"
          class="bw-folder__icon"
        />

        <span class="bw-collection__name">
          {{ collection.label }}
        </span>

        <span class="bw-folder__count">
          {{ collectionCount(collection.id) }}
        </span>
      </button>
    </div>
    </div>

    <!-- Footer -->
    <div class="bw-vault__footer">
      <NcButton @click="$emit('new')" type="primary">
        <template #icon><PlusIcon :size="16" /></template>
        Neuer Eintrag
      </NcButton>
      <NcButton @click="$emit('logout')">
        <template #icon><LogoutIcon :size="16" /></template>
        Abmelden
      </NcButton>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import NcButton    from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import ViewListOutlineIcon from 'vue-material-design-icons/ViewListOutline.vue'
import StarOutlineIcon from 'vue-material-design-icons/StarOutline.vue'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import FolderOutlineIcon from 'vue-material-design-icons/FolderOutline.vue'
import ArchiveOutlineIcon from 'vue-material-design-icons/ArchiveOutline.vue'
import ChevronRightIcon from 'vue-material-design-icons/ChevronRight.vue'
import ChevronDownIcon from 'vue-material-design-icons/ChevronDown.vue'
import PencilOutlineIcon from 'vue-material-design-icons/PencilOutline.vue'
import DeleteOutlineIcon from 'vue-material-design-icons/DeleteOutline.vue'
import PlusIcon    from 'vue-material-design-icons/Plus.vue'
import LogoutIcon  from 'vue-material-design-icons/Logout.vue'

const props = defineProps({
  items: Array,
  folders: Array,
  collections: Array,
  selectedId: String,
})
const emit = defineEmits([
  'new',
  'logout',
  'filter-change',
  'navigate',
  'create-folder',
  'edit-folder',
  'delete-folder',
])

const search                   = ref('')
const selectedFolder           = ref(null)
const selectedCollection       = ref(null)
const selectedCategory         = ref('all')
const sortMode                 = ref('name-asc')
const collapsedCollectionPaths = ref(new Set())
const t                = (s) => s

const categories = [
  {
    id: 'all',
    label: 'Alle Einträge',
    icon: ViewListOutlineIcon,
  },
  {
    id: 'favorites',
    label: 'Favoriten',
    icon: StarOutlineIcon,
  },
  {
    id: 'logins',
    label: 'Logins',
    icon: KeyOutlineIcon,
  },
  {
    id: 'notes',
    label: 'Sichere Notizen',
    icon: NoteTextOutlineIcon,
  },
  {
    id: 'cards',
    label: 'Karten',
    icon: CreditCardOutlineIcon,
  },
  {
    id: 'identities',
    label: 'Identitäten',
    icon: IdentityOutlineIcon,
  },
]

const nameCollator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
})

function normalizeId(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  return String(value).trim().toLowerCase()
}

function normalizePath(value) {
  return String(value ?? '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .join('/')
}

const sortedFolders = computed(() => {
  return [...(props.folders ?? [])].sort((a, b) =>
    nameCollator.compare(a.name ?? '', b.name ?? '')
  )
})

const allCollectionRows = computed(() => {
  const rows = (props.collections ?? [])
    .map(collection => {
      const path = normalizePath(collection.name)
      const parts = path ? path.split('/') : ['(ohne Name)']
      const organizationId = normalizeId(collection.organizationId) ?? ''

      return {
        ...collection,
        path,
        label: parts[parts.length - 1],
        depth: Math.max(parts.length - 1, 0),
        nodeKey: `${organizationId}:${path}`,
      }
    })
    .sort((a, b) => {
      const organizationDifference = nameCollator.compare(
        normalizeId(a.organizationId) ?? '',
        normalizeId(b.organizationId) ?? '',
      )

      return organizationDifference || nameCollator.compare(a.path, b.path)
    })

  return rows.map(row => ({
    ...row,
    hasChildren: rows.some(candidate =>
      normalizeId(candidate.organizationId)
        === normalizeId(row.organizationId)
      && candidate.path !== row.path
      && candidate.path.startsWith(`${row.path}/`)
    ),
  }))
})

const collectionRows = computed(() => {
  return allCollectionRows.value.filter(row => {
    const parts = row.path.split('/')
    const organizationId = normalizeId(row.organizationId) ?? ''

    for (let depth = 1; depth < parts.length; depth += 1) {
      const ancestorPath = parts.slice(0, depth).join('/')
      const ancestorKey = `${organizationId}:${ancestorPath}`

      if (collapsedCollectionPaths.value.has(ancestorKey)) {
        return false
      }
    }

    return true
  })
})

function selectCategory(categoryId) {
  selectedCategory.value = categoryId
  selectedFolder.value = null
  selectedCollection.value = null
  emit('navigate')
}

function selectFolder(folderId) {
  selectedFolder.value = folderId === '__none__'
    ? '__none__'
    : normalizeId(folderId)

  selectedCollection.value = null
  selectedCategory.value = 'all'
  emit('navigate')
}

function selectCollection(collectionId) {
  selectedCollection.value = normalizeId(collectionId)
  selectedFolder.value = null
  selectedCategory.value = 'all'
  emit('navigate')
}

function toggleCollection(collection) {
  if (!collection.hasChildren) {
    selectCollection(collection.id)
    return
  }

  const paths = new Set(collapsedCollectionPaths.value)

  if (paths.has(collection.nodeKey)) {
    paths.delete(collection.nodeKey)
  } else {
    paths.add(collection.nodeKey)
  }

  collapsedCollectionPaths.value = paths
}

function isCollectionCollapsed(collection) {
  return collapsedCollectionPaths.value.has(collection.nodeKey)
}

function categoryMatches(item, categoryId) {
  switch (categoryId) {
    case 'favorites':
      return Boolean(item.favorite)
    case 'logins':
      return Number(item.type) === 1
    case 'notes':
      return Number(item.type) === 2
    case 'cards':
      return Number(item.type) === 3
    case 'identities':
      return Number(item.type) === 4
    case 'all':
    default:
      return true
  }
}

function categoryCount(categoryId) {
  return (props.items ?? []).filter(item =>
    categoryMatches(item, categoryId)
  ).length
}

function folderCount(folderId) {
  const normalizedFolderId = normalizeId(folderId)

  return (props.items ?? []).filter(item =>
    normalizeId(item.folderId) === normalizedFolderId
  ).length
}

function itemBelongsToCollection(item, collectionId) {
  const normalizedCollectionId = normalizeId(collectionId)

  return (item.collectionIds ?? []).some(itemCollectionId =>
    normalizeId(itemCollectionId) === normalizedCollectionId
  )
}

function collectionCount(collectionId) {
  return (props.items ?? []).filter(item =>
    itemBelongsToCollection(item, collectionId)
  ).length
}

function compareName(a, b) {
  return nameCollator.compare(a.name ?? '', b.name ?? '')
}

function revisionTimestamp(item) {
  const timestamp = Date.parse(item.revisionDate ?? '')
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const filtered = computed(() => {
  let list = [...(props.items ?? [])]

  if (selectedCollection.value !== null) {
    list = list.filter(item =>
      itemBelongsToCollection(item, selectedCollection.value)
    )
  } else if (selectedFolder.value === '__none__') {
    list = list.filter(item =>
      normalizeId(item.folderId) === null
    )
  } else if (selectedFolder.value !== null) {
    list = list.filter(item =>
      normalizeId(item.folderId) === selectedFolder.value
    )
  } else {
    list = list.filter(item =>
      categoryMatches(item, selectedCategory.value)
    )
  }

  const term = search.value.trim().toLocaleLowerCase('de')

  if (term) {
    list = list.filter(item =>
      (item.name ?? '').toLocaleLowerCase('de').includes(term)
    )
  }

  switch (sortMode.value) {
    case 'name-desc':
      return list.sort((a, b) => compareName(b, a))

    case 'favorites':
      return list.sort((a, b) => {
        const favoriteDifference =
          Number(Boolean(b.favorite)) - Number(Boolean(a.favorite))

        return favoriteDifference || compareName(a, b)
      })

    case 'modified-desc':
      return list.sort((a, b) =>
        revisionTimestamp(b) - revisionTimestamp(a)
        || compareName(a, b)
      )

    case 'modified-asc':
      return list.sort((a, b) =>
        revisionTimestamp(a) - revisionTimestamp(b)
        || compareName(a, b)
      )

    case 'name-asc':
    default:
      return list.sort(compareName)
  }
})
const activeFilterLabel = computed(() => {
  if (selectedCollection.value !== null) {
    const collection = allCollectionRows.value.find(row =>
      normalizeId(row.id) === selectedCollection.value
    )

    return collection?.path || collection?.label || 'Sammlung'
  }

  if (selectedFolder.value === '__none__') {
    return 'Ohne persönlichen Ordner'
  }

  if (selectedFolder.value !== null) {
    const folder = (props.folders ?? []).find(candidate =>
      normalizeId(candidate.id) === selectedFolder.value
    )

    return folder?.name || 'Persönlicher Ordner'
  }

  return categories.find(category =>
    category.id === selectedCategory.value
  )?.label || 'Alle Einträge'
})

watch(
  () => props.folders,
  nextFolders => {
    if (
      selectedFolder.value === null
      || selectedFolder.value === '__none__'
    ) {
      return
    }

    const folderStillExists = (nextFolders ?? []).some(folder =>
      normalizeId(folder.id) === selectedFolder.value
    )

    if (!folderStillExists) {
      selectCategory('all')
    }
  },
  {
    deep: true,
  },
)

watch(
  [filtered, activeFilterLabel],
  ([filteredItems, label]) => {
    emit('filter-change', {
      items: [...filteredItems],
      label,
    })
  },
  {
    immediate: true,
    flush: 'sync',
  },
)

</script>

<style scoped>
.bw-vault {
  display:        flex;
  flex-direction: column;
  height:         100%;
  overflow:       hidden;
  background:     var(--color-navigation-bg, var(--color-main-background-translucent));
}

/* ── Suchleiste ── */
.bw-vault__search {
  padding: 0.75rem 0.75rem 0.5rem;
}

.bw-vault__sort {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0 0.75rem 0.75rem;
  border-bottom: 1px solid var(--color-border);
}

.bw-vault__sort label {
  font-size: 0.8rem;
  color: var(--color-text-maxcontrast);
}

.bw-vault__sort select {
  flex: 1;
  min-width: 0;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--color-border-dark);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
}

.bw-vault__navigation {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
  border-bottom: 1px solid var(--color-border);
}

.bw-vault__section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding-right: 0.5rem;
}

.bw-vault__section-title {
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-maxcontrast);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bw-vault__section-action {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-main-text);
  cursor: pointer;
}

.bw-vault__section-action:hover {
  background: var(--color-background-hover);
}

.bw-folder__icon {
  display: flex;
  width: 18px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.bw-collection__toggle {
  display: flex;
  width: 18px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.bw-collection__toggle--empty {
  cursor: default;
}

.bw-collection__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Ordner ── */
.bw-vault__folders {
  padding:       0.5rem 0;
  border-bottom: 1px solid var(--color-border);
}

.bw-folder {
  display:        flex;
  align-items:    center;
  gap:            0.5rem;
  width:          100%;
  padding:        0.4rem 0.75rem;
  border:         none;
  background:     transparent;
  cursor:         pointer;
  color:          var(--color-main-text);
  font-size:      0.85rem;
  text-align:     left;
  border-radius:  var(--border-radius);
  transition:     background 0.1s;
}
.bw-folder:hover       { background: var(--color-background-hover); }
.bw-folder--active     { background: var(--color-primary-element-light); font-weight: 600; }
.bw-folder__count {
  margin-left:   auto;
  font-size:     0.75rem;
  color:         var(--color-text-maxcontrast);
  background:    var(--color-background-dark);
  border-radius: 10px;
  padding:       0 0.4rem;
}

.bw-folder__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-folder-row {
  display: flex;
  align-items: center;
  border-radius: var(--border-radius);
}

.bw-folder-row:hover {
  background: var(--color-background-hover);
}

.bw-folder-row--active {
  background: var(--color-primary-element-light);
  font-weight: 600;
}

.bw-folder--main {
  min-width: 0;
  flex: 1;
}

.bw-folder--main:hover {
  background: transparent;
}

.bw-folder-row__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.1rem;
  padding-right: 0.35rem;
}

.bw-folder-row__action {
  display: flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--border-radius);
  background: transparent;
  color: var(--color-text-maxcontrast);
  cursor: pointer;
}

.bw-folder-row__action:hover,
.bw-folder-row__action:focus-visible {
  background: var(--color-background-dark);
  color: var(--color-main-text);
}

/* ── Footer ── */
.bw-vault__footer {
  display:       flex;
  flex-shrink:   0;
  gap:           0.5rem;
  padding:       0.75rem;
  border-top:    1px solid var(--color-border);
  background:    var(--color-navigation-bg, var(--color-main-background-translucent));
}
</style>
