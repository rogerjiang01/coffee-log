<script setup lang="ts">
// 豆袋照片的裁切介面。
//
// **.client.vue 與動態 import 都不可省略。** cropperjs v2 是 Web Components，
// 一 import 就會對八個元素呼叫 customElements.define()——伺服器端沒有
// customElements，SSR 時會直接炸掉。.client.vue 讓 Nuxt 只在瀏覽器算繪它；
// 動態 import 另外讓 cropperjs（約 470KB 未壓縮）不進主要 bundle，
// 只有真的要裁切時才載入。
//
// 互動：裁切框固定為正方形不動，底下的照片可以拖曳與縮放——
// 手機上移動框比移動照片難操作得多。
//   單指 → cropper-handle[action=move] → 照片平移
//   雙指 → canvas 判定為 TRANSFORM → 照片不可旋轉時降級成 SCALE → 照片縮放
// **不做旋轉**：rotatable 不開，雙指就只會縮放。
//
// 框內也要放一個 move 把手：選取框本身不可移動（沒有 movable），
// 照片才會在「從框內開始拖」時平移而不是去拖框。沒有這個把手，
// 在框內拖曳會因為指到的是選取框（沒有 action）而毫無反應。

const props = defineProps<{
  /** 使用者剛選的原圖 */
  file: Blob
}>()

const emit = defineEmits<{
  /** 裁切後的正方形圖，尚未壓縮——壓縮由呼叫端走既有流程 */
  confirm: [Blob]
  cancel: []
}>()

/** 輸出邊長。與壓縮的長邊上限一致，裁完不需要再縮 */
const OUTPUT_EDGE = 1600

const root = ref<HTMLElement | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const selection = ref<HTMLElement & { $toCanvas: (o: { width: number, height: number }) => Promise<HTMLCanvasElement> } | null>(null)
const ready = ref(false)
const working = ref(false)
const error = ref('')
const src = ref<string | null>(null)

// 開在 <dialog> 裡面時不能送 body：那裡是 inert，點了沒反應
const portalTarget = usePortalTarget(root)

onMounted(async () => {
  src.value = URL.createObjectURL(props.file)
  try {
    await import('cropperjs')
    ready.value = true
  }
  catch (e) {
    error.value = `裁切工具載入失敗：${errorText(e)}`
  }
  await nextTick()
  dialog.value?.showModal()
})

onBeforeUnmount(() => {
  if (src.value) URL.revokeObjectURL(src.value)
})

function toBlob(canvas: HTMLCanvasElement) {
  // PNG 無損：這一步只是把框內範圍取出來，真正的有損壓縮留給既有流程做一次。
  // 在這裡先轉 WebP 會變成壓兩次，畫質損失疊加。
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
}

async function confirm() {
  if (!selection.value || working.value) return
  working.value = true
  error.value = ''
  try {
    const canvas = await selection.value.$toCanvas({ width: OUTPUT_EDGE, height: OUTPUT_EDGE })
    const blob = await toBlob(canvas)
    if (!blob) throw new Error('裁切沒有成功')
    emit('confirm', blob)
  }
  catch (e) {
    error.value = errorText(e)
  }
  finally {
    working.value = false
  }
}
</script>

<template>
  <div ref="root">
    <Teleport :to="portalTarget">
      <!-- .sheet：鋪滿視窗的 <dialog>，焦點鎖定與 Esc 交給瀏覽器。
           Esc 等同取消：回到未選擇照片的狀態，不保留這張。 -->
      <dialog
        ref="dialog"
        class="sheet"
        aria-label="裁切照片"
        @cancel.prevent="emit('cancel')"
      >
        <div class="flex h-full flex-col" :style="{ background: 'var(--media-bg)' }">
          <div class="relative min-h-0 flex-1">
            <cropper-canvas
              v-if="ready && src"
              class="absolute inset-0"
              style="width: 100%; height: 100%"
            >
              <cropper-image
                :src="src"
                alt="要裁切的豆袋照片"
                initial-center-size="cover"
                translatable
                scalable
              />
              <cropper-shade theme-color="rgba(0, 0, 0, 0.55)" />
              <cropper-handle action="move" plain />
              <cropper-selection
                ref="selection"
                aspect-ratio="1"
                initial-coverage="0.9"
                outlined
              >
                <cropper-grid role="grid" bordered covered />
                <cropper-handle action="move" theme-color="transparent" />
              </cropper-selection>
            </cropper-canvas>
          </div>

          <p v-if="error" role="alert" class="px-5 pt-3 text-sm" :style="{ color: 'var(--on-media-danger)' }">
            {{ error }}
          </p>

          <!-- 次要在左、主要在右，與全站一致 -->
          <footer class="flex shrink-0 gap-3 px-5 py-3" :style="{ background: 'var(--media-bg)' }">
            <button
              type="button"
              class="flex-1 rounded-sm border px-4 py-3"
              :style="{ borderColor: 'var(--media-border)', color: 'var(--on-media)', minHeight: 'var(--touch-min)' }"
              @click="emit('cancel')"
            >
              取消
            </button>
            <button
              type="button"
              :disabled="!ready || working"
              class="flex-1 rounded-sm px-4 py-3 font-medium disabled:opacity-60"
              :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
              @click="confirm"
            >
              {{ working ? '處理中' : '使用這張' }}
            </button>
          </footer>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>
