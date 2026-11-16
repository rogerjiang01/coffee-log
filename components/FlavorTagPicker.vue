<script setup lang="ts">
// 風味標籤（《02-功能規格》§5 區塊四，L2）。
//
// 這組標籤不只是輸入輔助，更是給新手的詞彙教學——多數人不記錄風味
// 不是因為懶，是因為缺乏描述詞彙。因此依 category 分組顯示。

const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const supabase = useSupabaseClient()
const cache = useQueryCache()
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

async function fetchTags() {
  const { data, error: err } = await supabase
    .from('flavor_tags')
    .select('id, name, aliases, user_id, category')
    .order('user_id', { nullsFirst: true })
    .order('sort_order')
    .order('name')
  if (err) throw toError(err)
  return (data ?? []) as unknown as typeof tags.value
}

async function load() {
  await cache.swr(cacheKeys.lookup('flavor_tags'), fetchTags, {
    apply: (rows) => { tags.value = rows },
    // 未命中且失敗才顯示——背景重新驗證失敗不該蓋掉畫面上已經正確的標籤
    onError: (e) => { loadError.value = `讀不到風味標籤：${errorText(e)}` },
  }).settled
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
  cache.invalidateAfter({ kind: 'lookup', table: 'flavor_tags' })
  draft.value = ''
  toggle(created.id)
}
</script>

<template>
  <div>
    <!-- 卡片的第一列是標題與說明（Figma）。不再收合（2026-11-16） -->
    <div class="card-pad-x tag-head">
      <p class="text-sm text-muted">風味標籤</p>
      <p>請選取感受到的風味</p>
    </div>

    <!-- 每個分類一列：分類名稱在左、標籤靠右排，放不下就換行 -->
    <div v-for="[category, items] in groups" :key="category" class="card-pad-x tag-row">
      <p class="sheet-label">{{ category }}</p>
      <div class="flex min-w-0 flex-1 flex-wrap justify-end gap-2">
        <ChoiceChip
          v-for="tag in items"
          :key="tag.id"
          :selected="modelValue.includes(tag.id)"
          @click="toggle(tag.id)"
        >
          {{ tag.name }}
        </ChoiceChip>
      </div>
    </div>

    <FormNote v-if="loadError" tone="error">{{ loadError }}</FormNote>

    <!-- 最下面一列：新增風味詞。輸入是列裡的文字輸入（靠左），打了字才出現「新增」 -->
    <div class="card-pad-x tag-row">
      <!-- min-w-0 不可省略：輸入框預設 size="20" 的最小寬度會把按鈕擠出卡片 -->
      <input
        v-model="draft"
        type="text"
        placeholder="新增風味詞"
        aria-label="新增風味詞"
        class="sheet-input min-w-0 flex-1 text-left"
        @keydown.enter.prevent="create"
      >
      <AppButton
        v-if="canCreate"
        :busy="saving"
        class="shrink-0"
        @click="create"
      >
        {{ saving ? '新增中' : '新增' }}
      </AppButton>
    </div>

    <FormNote v-if="error" tone="error">{{ error }}</FormNote>
  </div>
</template>

<style scoped>
.tag-head {
  padding-block: 0.75rem;
}
.tag-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 4rem;
  padding-block: 0.75rem;
  border-top: 1px solid var(--border);
}
</style>
