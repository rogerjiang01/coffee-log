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
// **先打開 dialog，再算繪 cropper 元素。順序不可顛倒。**
// cropper-selection 只在 connectedCallback 量一次父層（cropper-canvas）的
// offsetWidth × initial-coverage 來決定框的大小，之後不再重算。
// 關著的 <dialog> 是 display: none，此時插入的話畫布量出來是 0×0，
// 框也就是 0×0——畫面上沒有框、cropper-shade 沒有東西可以壓暗、
// $toCanvas 輸出 0×0 的畫布而 toBlob 回傳 null。沒有任何錯誤訊息。
// 這個問題在隔離的測試 fixture 裡量不到（那裡的容器一開始就可見），
// 是在暫時的公開路由上掛真實元件才找到的。
//
// **照片永遠蓋滿裁切框**（iOS 內建與 Instagram 的裁切行為）：
//   初始  短邊剛好等於框的邊長、置中於框——不用 cropperjs 的 cover，
//         那是蓋滿畫布，框與照片的邊界不會對齊
//   縮放  縮到短邊等於框就停住，不回彈、不超過
//   拖曳  照片邊緣碰到框就停住，框內不會出現空白
// 雙指由這裡自己處理，下限在 clampPinchRatio；單指走 cropperjs 的 $move，
// 在 cropper-image 的 transform 事件裡用 clampToCover 修正。兩者共用
// utils/pinch.ts 的 minCoverScale，約束一致。框內因此不會露出黑底，
// 也不需要另外處理背景色。
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
const selection = ref<HTMLElement & {
  width: number
  height: number
  $toCanvas: (o: { width: number, height: number }) => Promise<HTMLCanvasElement>
} | null>(null)
const image = ref<HTMLElement & {
  $ready: () => Promise<HTMLImageElement>
  $move: (x: number, y: number) => unknown
  $zoom: (scale: number, x: number, y: number) => unknown
  $getTransform: () => number[]
  $setTransform: (matrix: number[]) => unknown
} | null>(null)
/** 照片的原始尺寸。有值才開始約束——cropperjs 載入時自己的置中不受限 */
let natural: Size | null = null
const canvasEl = ref<HTMLElement | null>(null)
const ready = ref(false)
/** 照片載入完成。確認鈕在這之前不可按——此時裁切必然是空的 */
const imageReady = ref(false)
const working = ref(false)
const error = ref('')
const src = ref<string | null>(null)

// 開在 <dialog> 裡面時不能送 body：那裡是 inert，點了沒反應
const portalTarget = usePortalTarget(root)

onMounted(async () => {
  src.value = URL.createObjectURL(props.file)

  // 1. 先讓 dialog 可見（等 Teleport 決定好目標再打開）
  await nextTick()
  dialog.value?.showModal()

  // 2. 再載入 cropperjs 並算繪元素——這時畫布量得到真實尺寸，框才有大小
  try {
    await import('cropperjs')
  }
  catch (e) {
    error.value = `裁切工具載入失敗：${errorText(e)}`
    return
  }
  ready.value = true

  // 3. 等照片真的載入完成，定位成「短邊等於框」，確認鈕才開放
  await nextTick()
  bindGestures()
  try {
    const loaded = await image.value?.$ready()
    if (loaded) applyInitialCover(loaded)
    imageReady.value = true
  }
  catch {
    error.value = '這張照片讀不進來，換一張試試'
  }
})

onBeforeUnmount(() => {
  if (src.value) URL.revokeObjectURL(src.value)
})

// ── 雙指：自己處理，不交給 cropperjs ─────────────────────────
//
// cropperjs 的雙指縮放以「剛觸發這次事件的那根手指」為錨點，不是兩指中點。
// 真實裝置一次只送一根手指的 pointermove，兩指一起滑動時就變成
// 「以 A 為中心放大一點、再以 B 為中心縮回一點」，淨效果是照片往反方向漂移
// ——實測兩指往右滑 64px，照片往左移了 68px。
//
// 做法：在捕獲階段攔下 canvas 的 action 事件並 preventDefault，
// cropper-image 的處理器一開頭就檢查 defaultPrevented，會直接跳過；
// 改由這裡以兩指中點為錨點縮放，再依中點的位移平移——照片跟著手指走。
// 縮放比例要經 zoomArg 換算：$zoom 對放大與縮小的公式不對稱，
// 直接傳「比例 - 1」時一縮一放抵不掉，縮放會一路飄（實測 5%，見 utils/pinch.ts）。
// 反向與縮放飄移是兩個不同的原因，只修錨點的話照片方向對了、大小仍會飄。
// 捕獲階段不可省略：cropper-image 的監聽器比這裡早註冊，
// 只有捕獲階段的監聽器能在目標階段搶在它前面執行。
// 單指拖曳仍然交給 cropperjs，那一條沒有問題。
const pointers = new Map<number, { x: number, y: number }>()
let lastPinch: { midX: number, midY: number, dist: number } | null = null

function measurePinch() {
  const [a, b] = [...pointers.values()]
  if (!a || !b) return null
  return { midX: (a.x + b.x) / 2, midY: (a.y + b.y) / 2, dist: Math.hypot(b.x - a.x, b.y - a.y) }
}

function onPointerDown(event: PointerEvent) {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  lastPinch = pointers.size === 2 ? measurePinch() : null
}

function onPointerMove(event: PointerEvent) {
  if (!pointers.has(event.pointerId)) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size !== 2 || !lastPinch || !image.value) return
  const now = measurePinch()
  if (!now || lastPinch.dist === 0) return
  // 縮放下限：縮到短邊等於框就停在那裡，與單指路徑用同一個 minCoverScale
  let ratio = now.dist / lastPinch.dist
  if (natural && selection.value) {
    const floor = minCoverScale(natural, selection.value.getBoundingClientRect())
    ratio = clampPinchRatio(ratio, image.value.$getTransform()[0] ?? 1, floor)
  }
  // 先以「上一刻的中點」為錨點縮放，再把照片移到「這一刻的中點」
  const rect = image.value.getBoundingClientRect()
  image.value.$zoom(zoomArg(ratio), lastPinch.midX - rect.x, lastPinch.midY - rect.y)
  image.value.$move(now.midX - lastPinch.midX, now.midY - lastPinch.midY)
  lastPinch = now
}

function onPointerUp(event: PointerEvent) {
  pointers.delete(event.pointerId)
  lastPinch = pointers.size === 2 ? measurePinch() : null
}

/** 兩指按著時，cropperjs 自己的縮放一律擋掉 */
function onCanvasAction(event: Event) {
  const action = (event as CustomEvent).detail?.action
  if (pointers.size >= 2 && (action === 'scale' || action === 'transform' || action === 'rotate')) {
    event.preventDefault()
  }
}

// ── 照片永遠蓋滿裁切框 ───────────────────────────────────────

/** 載入後的第一個位置：短邊等於框、置中於框 */
function applyInitialCover(loaded: HTMLImageElement) {
  const el = image.value
  const frame = selection.value
  if (!el || !frame) return
  natural = { width: loaded.naturalWidth, height: loaded.naturalHeight }
  const origin = untransformedCenter(el.getBoundingClientRect(), el.$getTransform() as Matrix)
  el.$setTransform(initialCover(natural, origin, frame.getBoundingClientRect()))
}

let correcting = false

/**
 * cropper-image 每次變形前都會發 transform 事件（可取消）。單指拖曳、
 * 雙指縮放後的平移都經過這裡。越界的那一步擋下來，改套修正後的矩陣——
 * 照片停在邊界上，而不是停在邊界前一步（只擋不修的話，快速拖曳會差好幾 px）。
 */
function onImageTransform(event: Event) {
  const el = image.value
  const frame = selection.value
  if (!natural || !el || !frame || correcting) return
  const { matrix, oldMatrix } = (event as CustomEvent<{ matrix: Matrix, oldMatrix: Matrix }>).detail
  // 事件發出時照片還套著舊矩陣，量到的是舊位置
  const origin = untransformedCenter(el.getBoundingClientRect(), oldMatrix)
  const bounded = clampToCover(matrix, natural, origin, frame.getBoundingClientRect())
  if (sameMatrix(bounded, matrix)) return
  event.preventDefault()
  correcting = true
  el.$setTransform(bounded)
  correcting = false
}

function bindGestures() {
  const el = canvasEl.value
  if (!el) return
  image.value?.addEventListener('transform', onImageTransform)
  el.addEventListener('pointerdown', onPointerDown, true)
  el.addEventListener('action', onCanvasAction, true)
  // 移動與放開聽 document：手指滑出畫布時仍要收到
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerup', onPointerUp, true)
  document.addEventListener('pointercancel', onPointerUp, true)
}

onBeforeUnmount(() => {
  image.value?.removeEventListener('transform', onImageTransform)
  canvasEl.value?.removeEventListener('pointerdown', onPointerDown, true)
  canvasEl.value?.removeEventListener('action', onCanvasAction, true)
  document.removeEventListener('pointermove', onPointerMove, true)
  document.removeEventListener('pointerup', onPointerUp, true)
  document.removeEventListener('pointercancel', onPointerUp, true)
})

function toBlob(canvas: HTMLCanvasElement) {
  // PNG 無損：這一步只是把框內範圍取出來，真正的有損壓縮留給既有流程做一次。
  // 在這裡先轉 WebP 會變成壓兩次，畫質損失疊加。
  return new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'))
}

async function confirm() {
  if (working.value) return
  error.value = ''

  // 每一種失敗都講出實際發生了什麼，不只說「沒有成功」
  if (!imageReady.value) {
    error.value = '照片還沒載入完成'
    return
  }
  const sel = selection.value
  if (!sel) {
    error.value = '裁切框還沒準備好'
    return
  }
  if (!(sel.width > 0 && sel.height > 0)) {
    error.value = '裁切框的大小是 0，沒有範圍可以輸出'
    return
  }

  working.value = true
  try {
    const canvas = await sel.$toCanvas({ width: OUTPUT_EDGE, height: OUTPUT_EDGE })
    const blob = await toBlob(canvas)
    if (!blob) throw new Error('這台裝置無法把裁切結果轉成圖片')
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
            <!-- 定位完成前不顯示：cropperjs 載入時會先自己置中一次，
                 不藏起來的話會先閃一下那個位置。visibility 不影響版面，框照樣量得到尺寸 -->
            <cropper-canvas
              v-if="ready && src"
              ref="canvasEl"
              class="absolute inset-0"
              :style="{ width: '100%', height: '100%', visibility: imageReady ? 'visible' : 'hidden' }"
            >
              <cropper-image
                ref="image"
                :src="src"
                alt="要裁切的豆袋照片"
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
              :disabled="!imageReady || working"
              class="flex-1 rounded-sm px-4 py-3 font-medium disabled:opacity-60"
              :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
              @click="confirm"
            >
              {{ working ? '處理中' : '確認裁切' }}
            </button>
          </footer>
        </div>
      </dialog>
    </Teleport>
  </div>
</template>
