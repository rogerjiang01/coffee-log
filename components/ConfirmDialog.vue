<script setup lang="ts">
// 自訂對話框（《03-介面規範》§4.8）。
// 規格禁止使用瀏覽器原生的 alert / confirm / prompt。
// 文案說明會刪掉什麼、能不能復原；按鈕用具體動詞而非「確定」。

const props = defineProps<{
  open: boolean
  title: string
  body: string
  confirmLabel: string
  busy?: boolean
}>()

const emit = defineEmits<{ confirm: []; cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

watch(() => props.open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) dialog.value.showModal()
  if (!value && dialog.value.open) dialog.value.close()
})
</script>

<template>
  <!-- dialog 本身是滿版的置中容器（樣式在 main.css），卡片是內層這一個 -->
  <dialog
    ref="dialog"
    class="backdrop:bg-[var(--overlay-scrim)]"
    @cancel.prevent="emit('cancel')"
  >
    <div
      class="w-full max-w-sm rounded-lg p-6"
      :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <h2 class="font-serif text-lg font-bold">{{ title }}</h2>
      <p class="mt-3 text-sm">{{ body }}</p>

      <div class="mt-6 flex gap-3">
        <button
          type="button"
          class="flex-1 rounded-sm border px-4 py-3"
          :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
          @click="emit('cancel')"
        >
          取消
        </button>
        <button
          type="button"
          :disabled="busy"
          class="flex-1 rounded-sm px-4 py-3 font-medium disabled:opacity-60"
          :style="{ background: 'var(--danger)', color: 'var(--on-danger)', minHeight: 'var(--touch-min)' }"
          @click="emit('confirm')"
        >
          {{ busy ? '刪除中' : confirmLabel }}
        </button>
      </div>
    </div>
  </dialog>
</template>
