<script setup lang="ts">
// 沖煮表單的豆子欄位（《02-功能規格》§5 區塊一）。
//
// 未喝完的排前面。必須支援「就地新增」：只要豆名 ＋ 可選拍照，
// 儲存後自動選定，**不得跳離頁面導致已填內容遺失**——所以新增流程
// 完全在這個下拉裡完成，不做路由跳轉。

interface BeanOption {
  id: string
  name: string
  is_finished: boolean
  roast_date: string | null
}

const props = defineProps<{
  modelValue: string | null
  error?: string
}>()
const emit = defineEmits<{
  'update:modelValue': [string | null]
  'selected': [BeanOption | null]
}>()

const supabase = useSupabaseClient()
const cache = useQueryCache()
const userId = useCurrentUserId()
const { upload } = useBeanPhotos()

const beans = ref<BeanOption[]>([])
const loading = ref(true)
const open = ref(false)
const query = ref('')
const creating = ref(false)
// 就地新增的內容關掉不清空——使用者以為那只是「填一格」，
// 不會想到還要按儲存。詳見 useInlineDraft。
interface BeanInlineDraft { name: string, photo: CompressedImage | null }
const inlineDraft = useInlineDraft<BeanInlineDraft>('bean', () => ({ name: '', photo: null }))
const restored = inlineDraft.read()

const draftName = ref(restored.name)
const draftPhoto = ref<CompressedImage | null>(restored.photo)

// 每次改動都寫回去，而不是只在關閉時寫：關閉的路徑不只一條
//（按返回、點外面、Esc、整個元件被卸載），漏掉任何一條都會掉資料
watch([draftName, draftPhoto], () => {
  inlineDraft.save({ name: draftName.value, photo: draftPhoto.value })
})

// 已經留著內容時，照片要看得見才知道它還在。Blob 換成可以放進 <img> 的網址
const draftPhotoUrl = ref<string | null>(null)
watch(draftPhoto, (value) => {
  if (draftPhotoUrl.value) URL.revokeObjectURL(draftPhotoUrl.value)
  draftPhotoUrl.value = value ? URL.createObjectURL(value.blob) : null
}, { immediate: true })
onBeforeUnmount(() => {
  if (draftPhotoUrl.value) URL.revokeObjectURL(draftPhotoUrl.value)
})
const saving = ref(false)
const createError = ref('')

const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => beans.value.find(bean => bean.id === props.modelValue) ?? null)
const matches = computed(() =>
  filterLookup(
    query.value,
    beans.value.map(bean => ({ id: bean.id, name: bean.name, aliases: [], user_id: null })),
  ).map(match => beans.value.find(bean => bean.id === match.id)!).filter(Boolean),
)
const active = computed(() => matches.value.filter(bean => !bean.is_finished))
const finished = computed(() => matches.value.filter(bean => bean.is_finished))

async function fetchBeans() {
  const { data, error } = await supabase
    .from('beans')
    .select('id, name, is_finished, roast_date')
    .order('is_finished', { ascending: true })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
  if (error) throw toError(error)
  return (data ?? []) as unknown as BeanOption[]
}

async function load() {
  const { hit, settled } = cache.swr(cacheKeys.beanOptions(), fetchBeans, {
    apply: (rows) => {
      beans.value = rows
      // 編輯既有紀錄時 modelValue 早就設好了，載完要補送一次，
      // 否則父層拿不到烘焙日期，養豆天數不會顯示
      if (props.modelValue) {
        emit('selected', rows.find(bean => bean.id === props.modelValue) ?? null)
      }
    },
    onError: (e) => { createError.value = `讀不到豆子：${errorText(e)}` },
  })
  loading.value = !hit
  await settled
  loading.value = false
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))

const trigger = ref<HTMLButtonElement | null>(null)

const { style: panelStyle, isOutside } = useAnchoredPanel(root, panel, open)

// 浮層開在 <dialog> 裡面時不能送 body：那裡是 inert，點了沒反應
const portalTarget = usePortalTarget(root)

function onDocumentClick(event: MouseEvent) {
  // 浮層已 teleport 到 body，不能只檢查觸發元素的父層
  if (open.value && isOutside(event.target as Node)) close()
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    creating.value = false
    createError.value = ''
    await nextTick()
    // preventScroll：取得焦點時不要把畫面捲到這個欄位
    searchInput.value?.focus({ preventScroll: true })
  }
}

function close() {
  open.value = false
  query.value = ''
  creating.value = false
  // 焦點還給觸發按鈕。不還的話焦點會掉到 <body>：
  // 使用者按 Tab 會從整份文件的最上面重來，而焦點停在 body 時
  // 按 Enter 什麼都不會發生——看起來就像「鍵盤失效」。
  trigger.value?.focus()
}

function pick(id: string | null) {
  emit('update:modelValue', id)
  emit('selected', beans.value.find(bean => bean.id === id) ?? null)
  close()
}

function startCreate() {
  creating.value = true
  createError.value = ''
  // 上次留下的內容優先。完全空白時才拿搜尋字串當豆名——
  // 否則使用者打字搜尋一次就會把他上次填到一半的豆名蓋掉
  if (!draftName.value && !draftPhoto.value) draftName.value = query.value.trim()
}

async function create() {
  const name = draftName.value.trim()
  if (!name) {
    createError.value = '豆名尚未填寫'
    return
  }
  if (!userId.value) {
    createError.value = SESSION_EXPIRED
    return
  }

  saving.value = true
  createError.value = ''
  const { data, error } = await supabase
    .from('beans')
    .insert({ user_id: userId.value, name } as never)
    .select('id, name, is_finished, roast_date')
    .single()

  if (error || !data) {
    saving.value = false
    createError.value = `儲存失敗：${errorText(error)}`
    return
  }
  const created = data as unknown as BeanOption

  if (draftPhoto.value) {
    try {
      const path = await upload(userId.value, created.id, draftPhoto.value)
      await supabase.from('beans').update({ photo_path: path } as never).eq('id', created.id)
    }
    catch {
      // 豆子已經建好，照片失敗不該讓整個流程回不去
    }
  }

  saving.value = false
  // 存成功了，留著的內容要清掉，否則下次開會看到已經建好的那一筆
  inlineDraft.clear()
  draftName.value = ''
  draftPhoto.value = null
  beans.value = [created, ...beans.value]
  // 就地新增的豆子要出現在豆子列表與首頁上區
  cache.invalidateAfter({ kind: 'bean' })
  pick(created.id)
}
</script>

<template>
  <div ref="root" class="relative">
    <label class="block text-sm" for="brew-bean">
      豆子
      <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
      <span class="sr-only">必填</span>
    </label>

    <button
      ref="trigger"
      id="brew-bean"
      type="button"
      role="combobox"
      :aria-expanded="open"
      :disabled="loading"
      class="mt-1 flex w-full items-center justify-between field px-3 py-2.5 text-left"
      data-field
      :data-filled="!!selected"
      :style="{ minHeight: 'var(--touch-min)' }"
      @click="toggle"
    >
      <span :style="{ color: selected ? 'var(--text)' : 'var(--text-muted)' }">
        {{ selected?.name ?? '選填' }}
      </span>
      <svg
        width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
        :style="{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform var(--motion-duration) var(--motion-ease)' }"
      >
        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <p v-if="error" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>

    <Teleport :to="portalTarget">
      <div
        v-if="open"
        ref="panel"
        class="fixed z-40 flex flex-col overflow-hidden rounded-sm border"
        :style="{ ...panelStyle, borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
        @click.stop
        @keydown.esc="close"
      >
        <template v-if="!creating">
          <div class="shrink-0 border-b p-2" :style="{ borderColor: 'var(--border)' }">
            <input
              ref="searchInput"
              v-model="query"
              type="text"
              placeholder="搜尋"
              class="block w-full field px-3 py-2"
              :style="{ minHeight: 'var(--touch-min)' }"
            >
          </div>

          <ul class="min-h-0 flex-1 overflow-y-auto">
            <li v-for="bean in active" :key="bean.id">
              <button
                type="button"
                class="block w-full truncate px-3 py-2 text-left"
                :style="{ minHeight: 'var(--touch-min)', background: bean.id === modelValue ? 'var(--accent-wash)' : undefined }"
                @click="pick(bean.id)"
              >
                {{ bean.name }}
              </button>
            </li>
            <template v-if="finished.length">
              <li class="px-3 pt-2 text-xs text-muted">已喝完</li>
              <li v-for="bean in finished" :key="bean.id">
                <button
                  type="button"
                  class="block w-full truncate px-3 py-2 text-left"
                  :style="{ minHeight: 'var(--touch-min)', background: bean.id === modelValue ? 'var(--accent-wash)' : undefined }"
                  @click="pick(bean.id)"
                >
                  {{ bean.name }}
                </button>
              </li>
            </template>
          </ul>

          <div class="shrink-0 border-t p-2" :style="{ borderColor: 'var(--border)' }">
            <button
              type="button"
              class="block w-full rounded-sm px-3 py-2 text-left"
              :style="{ minHeight: 'var(--touch-min)', color: 'var(--accent)' }"
              @click="startCreate"
            >
              {{ query.trim() ? `新增「${query.trim()}」` : '新增豆子' }}
            </button>
          </div>
        </template>

        <!-- 就地新增：只要豆名，照片可選，全程留在這一頁 -->
        <div v-else class="min-h-0 flex-1 overflow-y-auto p-3">
          <label class="block text-sm" for="new-bean-name">
            豆名
            <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
            <span class="sr-only">必填</span>
          </label>
          <input
            id="new-bean-name"
            v-model="draftName"
            type="text"
            class="mt-1 block w-full field px-3 py-2.5"
            :style="{ minHeight: 'var(--touch-min)' }"
          >

          <div class="mt-3">
            <PhotoField :preview-url="draftPhotoUrl" @picked="draftPhoto = $event" />
          </div>

          <p v-if="createError" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">
            {{ createError }}
          </p>

          <div class="mt-3 flex gap-2">
            <button
              type="button"
              :disabled="saving"
              class="flex-1 rounded-sm px-3 py-2 font-medium disabled:opacity-60"
              :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
              @click="create"
            >
              {{ saving ? '儲存中' : '儲存' }}
            </button>
            <button
              type="button"
              class="rounded-sm border px-3 py-2"
              :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }"
              @click="creating = false"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>