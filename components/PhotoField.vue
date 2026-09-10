<script setup lang="ts">
// 豆袋照片（《02-功能規格》§9）。
//
// 放在新增表單的最上方，是「不想打字的人」的逃生路徑：
// 壓縮在這裡完成，上傳時機由父層決定（新增時要先有 bean id）。
//
// 流程：選照片 → 裁切（正方形）→ 壓縮 → 交給父層。**裁切先於壓縮**，
// 壓縮仍走既有流程（長邊 1600、品質 0.8、WebP、2MB 上限）。
// 只存裁切後的圖，不存原圖與裁切參數——照片的用途是辨識，
// 使用者裁的時候本來就會把重要資訊框進去。
//
// 豆子表單與沖煮表單裡的就地新增都用這個元件，裁切因此兩處都有。

const props = defineProps<{
  previewUrl: string | null
}>()

const emit = defineEmits<{
  picked: [CompressedImage | null]
}>()

const localPreview = ref<string | null>(null)
/** 剛選的原圖，等裁切。有值時顯示裁切介面 */
const pending = ref<File | null>(null)
const working = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const shown = computed(() => localPreview.value ?? props.previewUrl)

function openPicker() {
  fileInput.value?.click()
}

function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  error.value = ''
  if (!file.type.startsWith('image/')) {
    error.value = '這個檔案不是圖片'
    resetInput()
    return
  }
  pending.value = file
}

/** 同一張圖取消後再選一次時，change 事件才會再觸發 */
function resetInput() {
  if (fileInput.value) fileInput.value.value = ''
}

async function onCropped(cropped: Blob) {
  pending.value = null
  resetInput()
  working.value = true
  try {
    const compressed = await compressBeanPhoto(cropped)
    if (localPreview.value) URL.revokeObjectURL(localPreview.value)
    localPreview.value = URL.createObjectURL(compressed.blob)
    emit('picked', compressed)
  }
  catch (e) {
    error.value = errorText(e)
  }
  working.value = false
}

/**
 * 裁切介面按取消：回到選照片之前的狀態，不保留這張。
 *
 * **不 emit picked(null)。** 編輯既有豆子時按「換一張」再取消，
 * 原本那張照片要留著——emit null 會讓父層以為使用者要移除照片。
 * 「不保留」指的是剛選的這張，不是原本就有的那張。
 */
function onCropCancel() {
  pending.value = null
  resetInput()
}

function clear() {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = null
  if (fileInput.value) fileInput.value.value = ''
  emit('picked', null)
}

onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
})
</script>

<template>
  <div>
    <p class="text-sm">豆袋照片</p>

    <!-- 單一檔案輸入，兩個按鈕都觸發它 -->
    <input
      ref="fileInput"
      type="file"
      accept="image/*"
      class="sr-only"
      @change="onPick"
    >

    <div
      class="mt-3 overflow-hidden rounded-md border"
      :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
    >
      <img
        v-if="shown"
        :src="shown"
        alt="豆袋照片"
        class="block max-h-72 w-full object-cover"
      >
      <button
        v-else
        type="button"
        class="flex w-full flex-col items-center justify-center px-4 py-10 text-center"
        :style="{ minHeight: '132px' }"
        @click="openPicker"
      >
        <span :style="{ color: 'var(--accent)' }">{{ working ? '處理中' : '拍照或選一張' }}</span>
      </button>
    </div>

    <p v-if="error" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>

    <PhotoCropper
      v-if="pending"
      :file="pending"
      @confirm="onCropped"
      @cancel="onCropCancel"
    />

    <div v-if="shown" class="mt-2 flex gap-3">
      <button
        type="button"
        class="rounded-sm border px-3 py-2 text-sm"
        :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
        @click="openPicker"
      >
        換一張
      </button>
      <button
        type="button"
        class="rounded-sm border px-3 py-2 text-sm"
        :style="{ borderColor: 'var(--border)', color: 'var(--text-muted)', minHeight: 'var(--touch-min)' }"
        @click="clear"
      >
        移除
      </button>
    </div>
  </div>
</template>
