<script setup lang="ts">
// 查表型欄位（《02-功能規格》§10 的共通行為）。
//
// - 系統內建項目排前面、自建排後面，以 optgroup 視覺區分
// - 選單底部提供「新增」
// - 自建時對現有項目（含 aliases）做模糊比對，命中時提示
//   「你是不是指『X』？」並提供直接選用
// - 全部選填，任何情況都不阻擋

const props = defineProps<{
  modelValue: string | null
  label: string
  table: 'processing_methods' | 'varieties' | 'regions'
  countryId?: string | null
  hint?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [string | null] }>()

const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const items = ref<LookupItem[]>([])
const loading = ref(true)
const creating = ref(false)
const draft = ref('')
const saveError = ref('')
const saving = ref(false)

const grouped = computed(() => splitBySource(items.value))
const suggestions = computed(() => findSimilar(draft.value, items.value))

async function load() {
  loading.value = true
  let query = supabase.from(props.table).select('id, name, aliases, user_id')
  // regions 依所選產國過濾；未選產國時全部列出，讓使用者不必先選國家
  if (props.table === 'regions' && props.countryId) {
    query = query.eq('country_id', props.countryId)
  }
  const { data } = await query.order('user_id', { nullsFirst: true }).order('sort_order')
  items.value = (data ?? []) as unknown as LookupItem[]
  loading.value = false
}

onMounted(load)
watch(() => props.countryId, () => {
  if (props.table === 'regions') load()
})

function onSelect(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  if (value === '__create__') {
    creating.value = true
    draft.value = ''
    saveError.value = ''
    return
  }
  emit('update:modelValue', value || null)
}

function useExisting(item: LookupItem) {
  emit('update:modelValue', item.id)
  creating.value = false
  draft.value = ''
}

async function create() {
  const name = draft.value.trim()
  if (!name) {
    saveError.value = '填一下名稱'
    return
  }
  if (!userId.value) {
    saveError.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  saving.value = true
  saveError.value = ''

  const row: Record<string, unknown> = { name, user_id: userId.value }
  if (props.table === 'regions' && props.countryId) row.country_id = props.countryId

  const { data, error } = await supabase
    .from(props.table)
    .insert(row as never)
    .select('id, name, aliases, user_id')
    .single()
  saving.value = false

  if (error) {
    saveError.value = `沒有存起來：${error.message}`
    return
  }
  const created = data as unknown as LookupItem
  items.value = [...items.value, created]
  emit('update:modelValue', created.id)
  creating.value = false
  draft.value = ''
}
</script>

<template>
  <div>
    <label class="block text-sm" :for="`lookup-${table}`">{{ label }}</label>

    <select
      :id="`lookup-${table}`"
      :value="modelValue ?? ''"
      :disabled="loading"
      class="mt-1 block w-full rounded-sm border px-3 py-2.5"
      :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
      @change="onSelect"
    >
      <option value="">不填</option>
      <optgroup v-if="grouped.system.length" label="內建">
        <option v-for="item in grouped.system" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </optgroup>
      <optgroup v-if="grouped.mine.length" label="我建立的">
        <option v-for="item in grouped.mine" :key="item.id" :value="item.id">
          {{ item.name }}
        </option>
      </optgroup>
      <option value="__create__">新增…</option>
    </select>

    <p v-if="hint" class="mt-1 text-xs text-muted">{{ hint }}</p>

    <div
      v-if="creating"
      class="mt-2 rounded-sm border p-3"
      :style="{ borderColor: 'var(--border)', background: 'var(--accent-wash)' }"
    >
      <label class="block text-sm" :for="`new-${table}`">新增「{{ label }}」</label>
      <input
        :id="`new-${table}`"
        v-model="draft"
        type="text"
        class="mt-1 block w-full rounded-sm border px-3 py-2.5"
        :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
      >

      <div v-if="suggestions.length" class="mt-3">
        <p class="text-sm">你是不是指這個？</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="item in suggestions"
            :key="item.id"
            type="button"
            class="rounded-sm border px-3 py-2 text-sm"
            :style="{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'var(--surface)', minHeight: '44px' }"
            @click="useExisting(item)"
          >
            {{ item.name }}
          </button>
        </div>
      </div>

      <p v-if="saveError" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ saveError }}</p>

      <div class="mt-3 flex gap-2">
        <button
          type="button"
          :disabled="saving"
          class="rounded-sm px-4 py-2 text-sm font-medium disabled:opacity-60"
          :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
          @click="create"
        >
          {{ saving ? '加入中' : '就用這個新的' }}
        </button>
        <button
          type="button"
          class="rounded-sm border px-4 py-2 text-sm"
          :style="{ borderColor: 'var(--border)', minHeight: '44px' }"
          @click="creating = false"
        >
          取消
        </button>
      </div>
    </div>
  </div>
</template>
