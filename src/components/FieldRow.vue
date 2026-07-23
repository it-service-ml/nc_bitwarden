<template>
  <div class="field-row">
    <label>{{ label }}</label>
    <div class="field-row__value">
      <span v-if="!secret || revealed">{{ value }}</span>
      <span v-else class="field-row__masked">••••••••</span>
      <NcButton v-if="secret" @click="revealed = !revealed" type="tertiary-no-background">
        <template #icon>
          <EyeOffOutlineIcon v-if="revealed" :size="16" />
          <EyeOutlineIcon    v-else          :size="16" />
        </template>
      </NcButton>
      <NcButton v-if="copyable" @click="copy" type="tertiary-no-background" aria-label="Kopieren">
        <template #icon><ContentCopyIcon :size="16" /></template>
      </NcButton>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import NcButton        from '@nextcloud/vue/components/NcButton'
import EyeOutlineIcon         from 'vue-material-design-icons/EyeOutline.vue'
import EyeOffOutlineIcon      from 'vue-material-design-icons/EyeOffOutline.vue'
import ContentCopyIcon from 'vue-material-design-icons/ContentCopy.vue'

const props    = defineProps({ label: String, value: String, secret: { type: Boolean, default: false }, copyable: { type: Boolean, default: false } })
const revealed = ref(false)
async function copy() { await navigator.clipboard.writeText(props.value ?? '') }
</script>

<style scoped>
.field-row         { padding: 0.6rem 1rem; display: flex; flex-direction: column; }
.field-row label   { font-size: 0.75rem; font-weight: 600; color: var(--color-text-maxcontrast); text-transform: uppercase; margin-bottom: 0.2rem; }
.field-row__value  { display: flex; align-items: center; gap: 0.25rem; }
.field-row__masked { letter-spacing: 0.15em; color: var(--color-text-maxcontrast); }
</style>
