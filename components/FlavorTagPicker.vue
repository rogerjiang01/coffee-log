<script setup lang="ts">
// 風味標籤（《02-功能規格》§5 區塊四，L2）。
//
// 這組標籤不只是輸入輔助，更是給新手的詞彙教學——多數人不記錄風味
// 不是因為懶，是因為缺乏描述詞彙。因此依 category 分組顯示。

const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const supabase = useSupabaseClient()
const userId = useCurrentUserId()

const tags = ref<(LookupItem & { category: string | null })[]>([])
const draft = ref('')
const saving = ref(false)
const error = ref('')

const groups = computed(() => {
  const order = ['酸質', '甜感', '口感', '風味', '缺陷']
  const map = new Map<string, typeof tags.value>()
  for (const tag of tags.value) {
    const key = tag.category ?? '我建立的'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(tag)
  }
  return [...map.entries()].sort(
    (a, b) => (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99),
  )
})

const canCreate = computed(() =>
  draft.value.trim().length > 0 && !hasExactMatch(draft.value, tags.value),
)

async function load() {
  const { data } = await supabase
    .from('flavor_tags')
    .select('id, name, aliases, user_id, category')
    .order('user_id', { nullsFirst: true })
    .order('sort_order')
    .order('name')
  tags.value = (data ?? []) as unknown as typeof tags.value
}
onMounted(load)

function toggle(id: string) {
  const next = props.modelValue.includes(id)
    ? props.modelValue.filter(item => item !== id)
    : [...props.modelValue, id]
  emit('update:modelValue', next)
}

async function create() {
  const name = draft.value.trim()
  if (!name || saving.value) return
  if (!userId.value) {
    error.value = '登入狀態好像過期了，重新登入一次再試'
    return
  }
  saving.value = true
  error.value = ''
  const { data, error: insertError } = await supabase
    .from('flavor_tags')
    .insert({ user_id: userId.value, name } as never)
    .select('id, name, aliases, user_id, category')
    .single()
  saving.value = false
  if (insertError || !data) {
    error.value = `沒有新增成功：${insertError?.message ?? '未知狀況'}`
    return
  }
  const created = data as unknown as (typeof tags.value)[number]
  tags.value = [...tags.value, created]
  draft.value = ''
  toggle(created.id)
}
</script>

<template>
  <div>
    <div v-for="[category, items] in groups" :key="category" class="mt-3 first:mt-0">
      <p class="text-xs text-muted">{{ category }}</p>
      <div class="mt-1 flex flex-wrap gap-2">
        <button
          v-for="tag in items"
          :key="tag.id"
          type="button"
          :aria-pressed="modelValue.includes(tag.id)"
          class="rounded-sm border px-3 py-2 text-sm"
          :style="modelValue.includes(tag.id)
            ? { borderColor: 'var(--accent)', background: 'var(--accent-wash)', color: 'var(--on-accent-wash)', minHeight: '44px' }
            : { borderColor: 'var(--field-border)', background: 'var(--field-bg)', minHeight: '44px' }"
          @click="toggle(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <div class="mt-4 flex gap-2">
      <input
        v-model="draft"
        type="text"
        placeholder="想到別的詞就打在這裡"
        class="block flex-1 rounded-sm border px-3 py-2.5"
        :style="{ borderColor: 'var(--field-border)', background: 'var(--field-bg)', minHeight: '44px' }"
      >
      <button
        v-if="canCreate"
        type="button"
        :disabled="saving"
        class="shrink-0 rounded-sm px-4 py-2 text-sm font-medium disabled:opacity-60"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: '44px' }"
        @click="create"
      >
        {{ saving ? '新增中' : '新增' }}
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>
  </div>
</template>
