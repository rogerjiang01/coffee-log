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

// 讀不到標籤時要講出來。原本無聲失敗，畫面只會是一片空白的標籤區，
// 使用者不知道是「還沒有標籤」還是「讀取失敗」。
const loadError = ref('')

async function load() {
  try {
    const { data, error: err } = await supabase
      .from('flavor_tags')
      .select('id, name, aliases, user_id, category')
      .order('user_id', { nullsFirst: true })
      .order('sort_order')
      .order('name')
    if (err) throw toError(err)
    tags.value = (data ?? []) as unknown as typeof tags.value
  }
  catch (e) {
    loadError.value = `讀不到風味標籤：${errorText(e)}`
  }
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
    error.value = SESSION_EXPIRED
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
    error.value = `新增失敗：${errorText(insertError)}`
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
            ? { borderColor: 'var(--accent)', background: 'var(--accent-wash)', color: 'var(--on-accent-wash)', minHeight: 'var(--touch-min)' }
            : { minHeight: 'var(--touch-min)' }"
          @click="toggle(tag.id)"
        >
          {{ tag.name }}
        </button>
      </div>
    </div>

    <p v-if="loadError" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">
      {{ loadError }}
    </p>

    <div class="mt-4 flex gap-2">
      <input
        v-model="draft"
        type="text"
        placeholder="新增風味詞"
        class="block flex-1 field px-3 py-2.5"
        :style="{ minHeight: 'var(--touch-min)' }"
      >
      <button
        v-if="canCreate"
        type="button"
        :disabled="saving"
        class="shrink-0 rounded-sm px-4 py-2 text-sm font-medium disabled:opacity-60"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
        @click="create"
      >
        {{ saving ? '新增中' : '新增' }}
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>
  </div>
</template>
