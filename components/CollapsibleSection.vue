<script setup lang="ts">
// L2 收合區（《03-介面規範》§4.2）。
// 展開狀態需記憶：使用者展開過一次，之後預設展開。
// 這是本產品唯一的使用者分級機制——用行為推斷，不用問卷詢問。
//
// 放在分組卡片裡：標題列是表單的一列（標籤的樣式、右端一個收合箭頭），
// 展開的內容接在下面，與標題列之間一條分隔線。左右內距自己帶，外面用 <FormRow flush>。
//
// v-model:open：外面的卡片要知道現在是不是收合著——收合時只有一列，卡片是膠囊形（FormCard 的 pill）。

const props = defineProps<{
  title: string
  storageKey: string
}>()

const open = defineModel<boolean>('open', { default: false })

onMounted(() => {
  try {
    open.value = localStorage.getItem(props.storageKey) === 'true'
  }
  catch {
    // 私密瀏覽等情境讀不到 localStorage，維持預設收合即可
  }
})

function toggle() {
  open.value = !open.value
  // 只記「曾經展開過」，收合不會把它忘掉
  if (open.value) {
    try {
      localStorage.setItem(props.storageKey, 'true')
    }
    catch {}
  }
}
</script>

<template>
  <section>
    <button
      type="button"
      class="sheet-row card-pad-x w-full text-left"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="sheet-label">{{ title }}</span>
      <svg
        width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"
        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
        :style="{
          color: 'var(--icon-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: `transform var(--motion-duration) var(--motion-ease)`,
        }"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </button>

    <!-- 分隔線畫在內容裡（inset 陰影），不另外佔 1px：列高才會是 --sheet-row-h -->
    <div v-show="open" :style="{ boxShadow: 'inset 0 1px 0 var(--border)' }">
      <slot />
    </div>
  </section>
</template>
