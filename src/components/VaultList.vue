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

    <!-- Kategorien -->
    <div class="bw-vault__folders">
      <div class="bw-vault__section-title">Kategorien</div>

      <button
        v-for="category in categories"
        :key="category.id"
        class="bw-folder"
        :class="{ 'bw-folder--active': selectedCategory === category.id && selectedFolder === null }"
        @click="selectCategory(category.id)"
      >
        <span class="bw-folder__icon">{{ category.icon }}</span>
        {{ category.label }}
        <span class="bw-folder__count">{{ categoryCount(category.id) }}</span>
      </button>
    </div>

    <!-- Ordner -->
    <div class="bw-vault__folders">
      <div class="bw-vault__section-title">Ordner</div>

      <button
        class="bw-folder"
        :class="{ 'bw-folder--active': selectedFolder === '__none__' }"
        @click="selectFolder('__none__')"
      >
        <span class="bw-folder__icon">📂</span>
        Ohne Ordner
        <span class="bw-folder__count">{{ folderCount(null) }}</span>
      </button>

      <button
        v-for="folder in sortedFolders"
        :key="folder.id"
        class="bw-folder"
        :class="{ 'bw-folder--active': selectedFolder === folder.id }"
        @click="selectFolder(folder.id)"
      >
        <FolderIcon :size="16" /> {{ folder.name }}
        <span class="bw-folder__count">{{ folderCount(folder.id) }}</span>
      </button>
    </div>

    <!-- Einträge -->
    <div class="bw-vault__items">
      <button
        v-for="item in filtered"
        :key="item.id"
        class="bw-item"
        :class="{ 'bw-item--active': selectedId === item.id }"
        @click="$emit('select', item)"
      >
        <span class="bw-item__icon">{{ typeIcon(item.type) }}</span>
        <span class="bw-item__name">{{ item.name || '(kein Name)' }}</span>
        <span v-if="item.favorite" class="bw-item__star">★</span>
      </button>

      <div v-if="filtered.length === 0" class="bw-vault__empty">
        <LockIcon :size="32" />
        <p>{{ search ? 'Keine Treffer' : 'Keine Einträge' }}</p>
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
import { ref, computed } from 'vue'
import NcButton    from '@nextcloud/vue/components/NcButton'
import NcTextField from '@nextcloud/vue/components/NcTextField'
import FolderIcon  from 'vue-material-design-icons/Folder.vue'
import LockIcon    from 'vue-material-design-icons/Lock.vue'
import PlusIcon    from 'vue-material-design-icons/Plus.vue'
import LogoutIcon  from 'vue-material-design-icons/Logout.vue'

const props = defineProps({ items: Array, folders: Array, selectedId: String })
const emit  = defineEmits(['select', 'new', 'logout'])

const search           = ref('')
const selectedFolder   = ref(null)
const selectedCategory = ref('all')
const sortMode         = ref('name-asc')
const t                = (s) => s

const categories = [
  { id: 'all',       label: 'Alle Einträge',   icon: '🌐' },
  { id: 'favorites', label: 'Favoriten',        icon: '★' },
  { id: 'logins',    label: 'Logins',           icon: '🔑' },
  { id: 'notes',     label: 'Sichere Notizen',  icon: '📝' },
  { id: 'cards',     label: 'Karten',            icon: '💳' },
  { id: 'identities', label: 'Identitäten',      icon: '🪪' },
]

const nameCollator = new Intl.Collator('de', {
  sensitivity: 'base',
  numeric: true,
})

const sortedFolders = computed(() => {
  return [...(props.folders ?? [])].sort((a, b) =>
    nameCollator.compare(a.name ?? '', b.name ?? '')
  )
})

function selectCategory(categoryId) {
  selectedCategory.value = categoryId
  selectedFolder.value = null
}

function selectFolder(folderId) {
  selectedFolder.value = folderId
  selectedCategory.value = 'all'
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
  return (props.items ?? []).filter(item => {
    if (folderId === null) {
      return item.folderId === null || item.folderId === undefined || item.folderId === ''
    }

    return item.folderId === folderId
  }).length
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

  if (selectedFolder.value === '__none__') {
    list = list.filter(item =>
      item.folderId === null
      || item.folderId === undefined
      || item.folderId === ''
    )
  } else if (selectedFolder.value !== null) {
    list = list.filter(item =>
      item.folderId === selectedFolder.value
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
function typeIcon(t) {
  return { 1: '🔑', 2: '📝', 3: '💳', 4: '🪪' }[t] ?? '🔒'
}
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

.bw-vault__section-title {
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-maxcontrast);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bw-folder__icon {
  width: 16px;
  flex-shrink: 0;
  text-align: center;
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

/* ── Eintrags-Liste ── */
.bw-vault__items {
  flex:           1;
  overflow-y:     auto;
  padding:        0.5rem;
  display:        flex;
  flex-direction: column;
  gap:            0.25rem;
}

/* ── Einzelner Eintrag (Karten-Optik wie Sidebar-Elemente) ── */
.bw-item {
  display:       flex;
  align-items:   center;
  gap:           0.6rem;
  width:         100%;
  padding:       0.55rem 0.75rem;
  border:        1px solid var(--color-border);
  border-radius: var(--border-radius);
  background:    var(--color-main-background);
  cursor:        pointer;
  text-align:    left;
  color:         var(--color-main-text);
  font-size:     0.9rem;
  transition:    background 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-shadow:    0 1px 2px rgba(0,0,0,.04);
}
.bw-item:hover {
  background:   var(--color-background-hover);
  border-color: var(--color-border-dark, var(--color-primary-element-light));
  box-shadow:   0 2px 6px rgba(0,0,0,.08);
}
.bw-item--active {
  background:   var(--color-primary-element-light);
  border-color: var(--color-primary-element);
  font-weight:  600;
}
.bw-item__icon { font-size: 1.1rem; flex-shrink: 0; }
.bw-item__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bw-item__star { color: #f4a800; font-size: 0.9rem; }

/* ── Leer-State ── */
.bw-vault__empty {
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  gap:             0.5rem;
  padding:         2rem;
  color:           var(--color-text-maxcontrast);
  text-align:      center;
}

/* ── Footer ── */
.bw-vault__footer {
  display:       flex;
  gap:           0.5rem;
  padding:       0.75rem;
  border-top:    1px solid var(--color-border);
  background:    var(--color-navigation-bg, var(--color-main-background-translucent));
}
</style>
