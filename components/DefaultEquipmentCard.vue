<script setup lang="ts">
// 「設為常用」：器材表單與器材選擇器的就地新增共用（《03》§4.0.1，2026-11-17）。
//
// 一張只有一列的卡片（膠囊形），列是開關（Figma 的 Sheet Row 的 toggle），標籤「設為常用」。
// 開關的位置本身就是狀態——舊的兩態按鈕（設為常用／取消常用）兩種狀態長得一樣，看不出目前是哪一種。
//
// 卡片下方的小字只說功能和規則：「新增紀錄時會自動帶入。同一類器材只能有一台常用。」
// **不在事前點名會換掉哪一台**：換掉常用是低成本、隨時可以改回來的動作，使用者打開開關時意圖已經很明確，
// 點名是把系統的顧慮丟給他判斷。後半句是補開關本身的誤導（開關看起來像各自獨立）。
// 換掉的結果在事後看得到：器材列表上目前的常用有「常用」標籤。
//
// **跟著表單儲存**：開關只改表單上的值，按「儲存」才寫進資料庫（同類型原本的常用在那時才被取消）。

defineProps<{ modelValue: boolean }>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
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
    <!-- 兩句各自一行：連在一起時 390px 下第二行只剩「用。」 -->
    <FormNote>
      <span class="w-full">新增紀錄時會自動帶入。</span>
      <span class="w-full">同一類器材只能有一台常用。</span>
    </FormNote>
  </FormCard>
</template>
