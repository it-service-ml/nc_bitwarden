<template>
  <NcDialog
    name="Passwort generieren"
    size="normal"
    @closing="$emit('close')"
  >
    <div class="bw-password-dialog">
      <NcPasswordField
        v-model="password"
        label="Generiertes Passwort"
      />

      <PasswordGenerator
        v-model="password"
        :initially-expanded="true"
      />
    </div>

    <template #actions>
      <NcButton @click="$emit('close')">
        Schließen
      </NcButton>
    </template>
  </NcDialog>
</template>

<script setup>
import { ref } from 'vue'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcPasswordField from '@nextcloud/vue/components/NcPasswordField'
import PasswordGenerator from './PasswordGenerator.vue'

defineEmits(['close'])

const password = ref('')
</script>

<style scoped>
.bw-password-dialog {
  display: flex;
  min-width: 420px;
  flex-direction: column;
  gap: 1rem;
  padding: 1rem;
}

@media (max-width: 600px) {
  .bw-password-dialog {
    min-width: 0;
  }
}
</style>
