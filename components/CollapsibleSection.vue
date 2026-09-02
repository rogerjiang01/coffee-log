<script setup lang="ts">
// L2 收合區（《03-介面規範》§4.2）。
// 展開狀態需記憶：使用者展開過一次，之後預設展開。
// 這是本產品唯一的使用者分級機制——用行為推斷，不用問卷詢問。

const props = defineProps<{
  title: string
  storageKey: string
  // 放在分組卡片內時不要自己的上緣線與外距——分隔線由 FormRow 提供
  flat?: boolean
}>()

const open = ref(false)

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
  <section :class="flat ? '' : 'mt-8 border-t pt-5'" :style="flat ? undefined : { borderColor: 'var(--border)' }">
    <button
      type="button"
      class="flex w-full items-center justify-between text-left"
      :style="{ minHeight: '44px' }"
      :aria-expanded="open"
      @click="toggle"
    >
      <span class="font-medium">{{ title }}</span>
      <svg
        width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
        :style="{
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: `transform var(--motion-duration) var(--motion-ease)`,
        }"
      >
        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <div v-show="open" class="mt-4">
      <slot />
    </div>
  </section>
</template>
