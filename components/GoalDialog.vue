<script setup lang="ts">
// 修改每週記錄目標的對話框（《02》§4.1、《03》§4.8）。
// 總覽點目標環卡片打開。儲存後新增一列目標（不是改舊的那一列），環立刻重算。
// 按鈕照對話框的既有規則：次要在左（取消）、主要在右（儲存）。

const props = defineProps<{
  open: boolean
  current: number
}>()

const emit = defineEmits<{ close: [], saved: [] }>()

const supabase = useSupabaseClient()
const userId = useCurrentUserId()
const cache = useQueryCache()

const dialog = ref<HTMLDialogElement | null>(null)
const heading = ref<HTMLElement | null>(null)
const cups = ref(props.current)
const saving = ref(false)
const error = ref('')

// 返回鍵等同「取消」
useOverlayHistory(() => props.open, () => emit('close'))

watch(() => props.open, (value) => {
  if (!dialog.value) return
  if (value && !dialog.value.open) {
    cups.value = props.current
    error.value = ''
    dialog.value.showModal()
    heading.value?.focus()
  }
  if (!value && dialog.value.open) dialog.value.close()
})

async function save() {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  saving.value = true
  error.value = ''
  const { error: insertError } = await supabase
    .from('weekly_goals')
    .insert({ user_id: userId.value, cups: clampGoal(cups.value) } as never)
  saving.value = false
  if (insertError) {
    error.value = `儲存失敗：${errorText(insertError)}`
    return
  }
  cache.invalidateAfter({ kind: 'goal' })
  emit('saved')
}
</script>

<template>
  <dialog
    ref="dialog"
    class="backdrop:bg-[var(--overlay-scrim)]"
    @cancel.prevent="emit('close')"
  >
    <div
      class="w-full max-w-sm rounded-lg p-6"
      :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }"
    >
      <h2 ref="heading" tabindex="-1" class="text-xl font-normal text-balance break-keep wrap-anywhere outline-none">每週記錄目標</h2>

      <div class="mt-6">
        <GoalStepper v-model="cups" />
      </div>

      <p v-if="error" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>

      <div class="mt-6 flex gap-3">
        <AppButton variant="outline"
          class="flex-1"
          @click="emit('close')"
        >
          取消
        </AppButton>
        <AppButton
          :busy="saving"
          class="flex-1"
          @click="save"
        >
          {{ saving ? '儲存中' : '儲存' }}
        </AppButton>
      </div>
    </div>
  </dialog>
</template>
