<script setup lang="ts">
// 編輯器材。流程型畫面：左上 ‹ 離開（暫存保留），底部是儲存（《03》§3）。
//
// 器材沒有詳情頁，刪除放在這裡：儲存之後，權重最低的位置。

definePageMeta({ screen: 'flow' })

const route = useRoute()
const supabase = useSupabaseClient()
const cache = useQueryCache()
const exitTo = useFlowExit()
const userId = useCurrentUserId()

const id = computed(() => String(route.params.id))

const initial = ref<Partial<EquipmentFormValues> | null>(null)
const currentName = ref<string | null>(null)
const loading = ref(true)
const loadError = ref('')
const notFound = ref(false)
const form = ref<{ clearDraft: () => void } | null>(null)
const saving = ref(false)
const error = ref('')
const confirmOpen = ref(false)
const deleting = ref(false)
const actionError = ref('')

// 只有資料到位才渲染表單（utils/loadState.ts）：讀不到卻顯示空白表單，
// 按下儲存就會把這台的名稱與備註覆蓋掉
const view = computed(() => loadView({
  loading: loading.value,
  loadError: loadError.value,
  notFound: notFound.value,
  loaded: initial.value !== null,
}))

async function load() {
  loading.value = true
  loadError.value = ''
  notFound.value = false
  initial.value = null
  try {
    const result = await supabase
      .from('user_equipment')
      .select(USER_EQUIPMENT_SELECT)
      .eq('id', id.value)
      .maybeSingle()
    const failed = firstQueryError(result)
    if (failed) throw toError(failed)
    if (!result.data) {
      notFound.value = true
      return
    }
    const row = result.data as unknown as UserEquipmentRow
    currentName.value = equipmentOptionName(row)
    initial.value = {
      type: row.type,
      catalog_id: row.catalog_id,
      custom_name: row.custom_name ?? '',
      note: row.note ?? '',
      is_default: row.is_default,
    }
  }
  catch (e) {
    initial.value = null
    loadError.value = `讀不到資料：${errorText(e)}`
  }
  finally {
    // finally：任何失敗都不能讓頁面停在「讀取中」
    loading.value = false
  }
}

onMounted(load)

async function onSubmit(values: EquipmentFormValues) {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  saving.value = true
  error.value = ''
  try {
    if (values.is_default) await clearDefaultEquipment(supabase, userId.value, values.type, id.value)
    const { error: updateError } = await supabase
      .from('user_equipment')
      .update({
        type: values.type,
        catalog_id: values.catalog_id,
        custom_name: values.catalog_id ? null : values.custom_name.trim(),
        note: values.note.trim() || null,
        is_default: values.is_default,
      } as never)
      .eq('id', id.value)
    if (updateError) throw toError(updateError)
  }
  catch (e) {
    saving.value = false
    error.value = `儲存失敗：${errorText(e)}`
    return
  }
  form.value?.clearDraft()
  cache.invalidateAfter({ kind: 'equipment' })
  // 上一頁就是器材列表時退回去，否則取代表單那一筆（useFlowExit）
  await exitTo('/equipment')
}

async function destroy() {
  deleting.value = true
  const { error: deleteError } = await supabase.from('user_equipment').delete().eq('id', id.value)
  deleting.value = false
  confirmOpen.value = false
  if (deleteError) {
    actionError.value = `刪除失敗：${errorText(deleteError)}`
    return
  }
  form.value?.clearDraft()
  cache.invalidateAfter({ kind: 'equipment' })
  // 上一頁就是器材列表時退回去，否則取代表單那一筆（useFlowExit）
  await exitTo('/equipment')
}
</script>

<template>
  <main class="mx-auto px-5 pt-10 pb-16" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 離開的入口不跟著資料走：讀取中、讀取失敗、找不到都要看得到 -->
    <PageHeader
      :title="view === 'notFound' ? '找不到這個器材' : '編輯器材'"
      back="/equipment"
      back-label="離開"
    />

    <div v-if="view === 'loading'" aria-busy="true" aria-label="讀取中" class="mt-8">
      <div
        class="rounded-sm border p-5"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
      >
        <div class="space-y-4">
          <SkeletonBlock v-for="row in 4" :key="row" height="1.5rem" />
        </div>
      </div>
    </div>

    <!-- 讀取失敗不渲染表單（loadState.ts） -->
    <div v-else-if="view === 'error'" class="mt-8">
      <p role="alert" class="text-sm" :style="{ color: 'var(--danger)' }">{{ loadError }}</p>
      <button
        type="button"
        class="mt-4 w-full rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
        @click="load"
      >
        重試
      </button>
    </div>

    <template v-else-if="view === 'ready'">
      <div class="mt-8">
        <EquipmentForm
          ref="form"
          :draft-key="`draft:equipment:${id}`"
          :initial="initial ?? undefined"
          :current-name="currentName"
          submit-label="儲存"
          :busy="saving"
          :error="error"
          @submit="onSubmit"
        />
      </div>

      <p v-if="actionError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">{{ actionError }}</p>

      <!-- 低頻且不可復原：儲存之後、不帶邊框，是這一頁權重最低的動作 -->
      <button
        type="button"
        class="mt-3 w-full rounded-sm px-4 py-3 text-sm"
        :style="{ color: 'var(--danger)', minHeight: 'var(--touch-min)' }"
        @click="confirmOpen = true"
      >
        刪除
      </button>

      <ConfirmDialog
        :open="confirmOpen"
        title="刪除這個器材？"
        body="刪掉之後沒辦法復原。已經記錄過的沖煮不會消失，只是那筆紀錄上的器材欄位會變成空的。"
        confirm-label="刪除這個器材"
        :busy="deleting"
        @cancel="confirmOpen = false"
        @confirm="destroy"
      />
    </template>
  </main>
</template>
