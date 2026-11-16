<script setup lang="ts">
// 表單裡的一則小字：說明、提示、錯誤、衍生值（《03》§4.1）。
//
// **小字一律放在白色卡片的下方，不放進卡片裡**（2026-11-16）。寫的時候照樣寫在那一列旁邊
// （訊息跟著欄位的程式走），顯示時傳送到所在卡片下方的 footer（FormCard 提供的位置）。
// 不在卡片裡的時候就地顯示。
//
//   tone   info 參考資訊（--text-muted）、notice 不擋儲存的提示（--notice）、error 錯誤（--danger，前面加 circle-alert）
//   field  欄位名稱。同一張卡片有好幾列時要寫，讀的人才知道這一則說的是哪一列

withDefaults(defineProps<{
  tone?: 'info' | 'notice' | 'error'
  field?: string
}>(), { tone: 'info' })

// footer 在模板裡會自動解開成元素（掛載前是 null），所以另外記「是不是在卡片裡」
const footer = inject(FORM_CARD_FOOTER, null)
const inCard = footer !== null
</script>

<template>
  <Teleport v-if="inCard && footer" :to="footer">
    <p class="form-note" :data-tone="tone" :role="tone === 'error' ? 'alert' : undefined">
      <AlertIcon v-if="tone === 'error'" :size="14" />
      <span v-if="field" class="font-medium">{{ field }}</span>
      <slot />
    </p>
  </Teleport>
  <p v-else-if="!inCard" class="form-note" :data-tone="tone" :role="tone === 'error' ? 'alert' : undefined">
    <AlertIcon v-if="tone === 'error'" :size="14" />
    <span v-if="field" class="font-medium">{{ field }}</span>
    <slot />
  </p>
</template>
