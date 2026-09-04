<script setup lang="ts">
// 豆袋照片（《02-功能規格》§9）。
//
// 放在新增表單的最上方，是「不想打字的人」的逃生路徑：
// 壓縮在這裡完成，上傳時機由父層決定（新增時要先有 bean id）。

const props = defineProps<{
  previewUrl: string | null
}>()

const emit = defineEmits<{
  picked: [CompressedImage | null]
}>()

const localPreview = ref<string | null>(null)
const working = ref(false)
const error = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

const shown = computed(() => localPreview.value ?? props.previewUrl)

function openPicker() {
  fileInput.value?.click()
}

async function onPick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  working.value = true
  error.value = ''
  try {
    const compressed = await compressBeanPhoto(file)
    if (localPreview.value) URL.revokeObjectURL(localPreview.value)
    localPreview.value = URL.createObjectURL(compressed.blob)
    emit('picked', compressed)
  }
  catch (e) {
    error.value = errorText(e)
    emit('picked', null)
  }
  working.value = false
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
