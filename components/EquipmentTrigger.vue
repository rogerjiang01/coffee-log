<script setup lang="ts">
// 沖煮表單上的器材欄位。點下去開全頁選擇器，本身只負責顯示目前選了什麼。
// 表單的一列：標籤在左，已選的器材在右側的膠囊裡；還沒選時是「選填」，不畫膠囊（《03》§4.1）。

const props = defineProps<{ label: string, name: string | null }>()
defineEmits<{ open: [] }>()

const id = useId()
</script>

<template>
  <div class="sheet-row">
    <label class="sheet-label" :for="id">{{ props.label }}</label>
    <button :id="id" type="button" class="sheet-trigger" @click="$emit('open')">
      <SheetPill :empty="!name">{{ name ?? '選填' }}</SheetPill>
    </button>
  </div>
</template>
