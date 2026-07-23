<template>
  <section class="bw-items-panel">
    <header class="bw-items-panel__header">
      <div class="bw-items-panel__heading">
        <span class="bw-items-panel__eyebrow">Einträge</span>
        <h2 :title="title">{{ title }}</h2>
      </div>

      <span class="bw-items-panel__count">
        {{ items.length }}
      </span>
    </header>

    <div
      v-if="items.length > 0"
      class="bw-items-panel__list"
    >
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="bw-items-panel__item"
        :class="{
          'bw-items-panel__item--active': selectedId === item.id,
        }"
        @click="$emit('select', item)"
      >
        <component
          :is="typeIcon(item.type)"
          :size="19"
          class="bw-items-panel__icon"
        />

        <span class="bw-items-panel__content">
          <strong>{{ item.name || '(kein Name)' }}</strong>

          <small v-if="itemSubtitle(item)">
            {{ itemSubtitle(item) }}
          </small>
        </span>

        <StarIcon
          v-if="item.favorite"
          :size="16"
          class="bw-items-panel__favorite"
          title="Favorit"
        />

        <ChevronRightIcon
          :size="18"
          class="bw-items-panel__arrow"
        />
      </button>
    </div>

    <div
      v-else
      class="bw-items-panel__empty"
    >
      <LockOutlineIcon :size="38" />
      <strong>Keine Einträge</strong>
      <span>Für diese Auswahl wurden keine Einträge gefunden.</span>
    </div>
  </section>
</template>

<script setup>
import ViewListOutlineIcon from 'vue-material-design-icons/ViewListOutline.vue'
import StarIcon from 'vue-material-design-icons/Star.vue'
import KeyOutlineIcon from 'vue-material-design-icons/KeyOutline.vue'
import NoteTextOutlineIcon from 'vue-material-design-icons/NoteTextOutline.vue'
import CreditCardOutlineIcon from 'vue-material-design-icons/CreditCardOutline.vue'
import IdentityOutlineIcon from 'vue-material-design-icons/CardAccountDetailsOutline.vue'
import ChevronRightIcon from 'vue-material-design-icons/ChevronRight.vue'
import LockOutlineIcon from 'vue-material-design-icons/LockOutline.vue'

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: 'Alle Einträge',
  },
  selectedId: {
    type: String,
    default: null,
  },
})

defineEmits(['select'])

function typeIcon(type) {
  return {
    1: KeyOutlineIcon,
    2: NoteTextOutlineIcon,
    3: CreditCardOutlineIcon,
    4: IdentityOutlineIcon,
  }[Number(type)] ?? ViewListOutlineIcon
}

function itemSubtitle(item) {
  switch (Number(item.type)) {
    case 1:
      return item.login?.username || 'Zugangsdaten'

    case 2:
      return 'Sichere Notiz'

    case 3:
      return item.card?.brand || 'Karte'

    case 4:
      return item.identity?.email || 'Identität'

    default:
      return ''
  }
}
</script>

<style scoped>
.bw-items-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
  background: var(--color-main-background);
}

.bw-items-panel__header {
  display: flex;
  min-height: 66px;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border);
}

.bw-items-panel__heading {
  min-width: 0;
}

.bw-items-panel__eyebrow {
  display: block;
  margin-bottom: 0.15rem;
  color: var(--color-text-maxcontrast);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bw-items-panel__header h2 {
  overflow: hidden;
  margin: 0;
  font-size: 1rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-items-panel__count {
  min-width: 24px;
  flex-shrink: 0;
  padding: 0.1rem 0.45rem;
  border-radius: 10px;
  background: var(--color-background-dark);
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
  text-align: center;
}

.bw-items-panel__list {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.3rem;
  overflow-y: auto;
  padding: 0.5rem;
  scrollbar-gutter: stable;
}

.bw-items-panel__item {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: var(--border-radius);
  background: var(--color-main-background);
  color: var(--color-main-text);
  cursor: pointer;
  text-align: left;
  transition:
    background 0.15s,
    border-color 0.15s,
    box-shadow 0.15s;
}

.bw-items-panel__item:hover {
  border-color: var(--color-border-dark);
  background: var(--color-background-hover);
}

.bw-items-panel__item--active {
  border-color: var(--color-primary-element);
  background: var(--color-primary-element-light);
  box-shadow: inset 3px 0 0 var(--color-primary-element);
}

.bw-items-panel__icon {
  flex-shrink: 0;
  color: currentColor;
}

.bw-items-panel__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 0.1rem;
}

.bw-items-panel__content strong,
.bw-items-panel__content small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.bw-items-panel__content strong {
  font-size: 0.9rem;
}

.bw-items-panel__content small {
  color: var(--color-text-maxcontrast);
  font-size: 0.75rem;
}

.bw-items-panel__favorite {
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.7;
}

.bw-items-panel__arrow {
  flex-shrink: 0;
  color: currentColor;
  opacity: 0.55;
}

.bw-items-panel__empty {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem;
  color: var(--color-text-maxcontrast);
  text-align: center;
}

.bw-items-panel__empty span {
  font-size: 0.85rem;
}
</style>
