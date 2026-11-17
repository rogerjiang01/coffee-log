<script setup lang="ts">
// 「設為常用」：器材表單與器材選擇器的就地新增共用（《03》§4.0.1，2026-11-17）。
//
// 一張只有一列的卡片（膠囊形），列是開關（Figma 的 Sheet Row 的 toggle），標籤「設為常用」。
// 卡片下方的小字說明作用與取代關係：
//   同一種器材已經有常用（而且不是這一台）  新增紀錄時會自動帶入。目前的常用是 ○○，開啟後會改成這一台
//   還沒有常用                              新增紀錄時會自動帶入
// 開關的位置本身就是狀態，所以不再有按下之後的「已將 X 設為常用」。
//
// **跟著表單儲存**：開關只改表單上的值，按「儲存」才寫進資料庫（同類型原本的常用在那時才被取消）。

const props = defineProps<{
  modelValue: boolean
  /** 同一種器材目前的常用（不含這一台）的名稱。沒有就是 null */
  currentDefault: string | null
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

const note = computed(() => props.currentDefault
  ? `新增紀錄時會自動帶入。目前的常用是 ${props.currentDefault}，開啟後會改成這一台`
  : '新增紀錄時會自動帶入')
</script>

<template>
  <FormCard pill>
    <FormRow>
      <ToggleSwitch
        :model-value="modelValue"
        label="設為常用"
        row
        @update:model-value="emit('update:modelValue', $event)"
      />
    </FormRow>
    <FormNote>{{ note }}</FormNote>
  </FormCard>
</template>
