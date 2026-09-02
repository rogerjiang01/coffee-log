<script setup lang="ts">
// 沖煮表單的器材欄位。新增紀錄時各類型的預設器材會自動帶入（§3.3）。

// EquipmentOption 定義在 utils/equipment.ts，由 Nuxt 自動匯入

const props = defineProps<{
  modelValue: string | null
  label: string
  type: EquipmentType
  options: EquipmentOption[]
}>()

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const forType = computed(() => props.options.filter(item => item.type === props.type))
const selected = computed(() => forType.value.find(item => item.id === props.modelValue) ?? null)
</script>

<template>
  <div>
    <label class="block text-sm" :for="`equipment-${type}`">{{ label }}</label>
    <select
      :id="`equipment-${type}`"
      :value="modelValue ?? ''"
      class="mt-1 block w-full rounded-sm border px-3 py-2.5"
      :style="{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        minHeight: '44px',
        color: modelValue ? 'var(--text)' : 'var(--text-muted)',
      }"
      @change="emit('update:modelValue', ($event.target as HTMLSelectElement).value || null)"
    >
      <option value="">選填</option>
      <option v-for="item in forType" :key="item.id" :value="item.id">
        {{ equipmentOptionName(item) }}
      </option>
    </select>
    <p v-if="!forType.length" class="mt-1 text-xs text-muted">
      還沒有{{ label }}，到器材頁可以先建起來
    </p>
    <p v-else-if="selected?.is_default" class="mt-1 text-xs text-muted">預設器材</p>
  </div>
</template>
