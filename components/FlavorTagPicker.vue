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

// 「新增」可以按的條件：有輸入，而且不是已經有的詞（名稱或別名正規化之後相同，hasExactMatch）。
// Return 鍵和按鈕走同一個條件——原本 Return 不看這一條，會建出重複的詞
const canCreate = computed(() =>
  draft.value.trim().length > 0 && !hasExactMatch(draft.value, tags.value),
)

// 最下面那一列的兩種狀態（2026-11-17，iOS 新增項目的慣例）：
//   平常    一列 --accent-text 的「＋ 新增風味詞」，看起來是一個動作（和「編輯分段」那一列同一種做法）
//   輸入中  提示字「輸入風味詞」，右邊「新增」按鈕。新增之後維持輸入狀態、保留焦點，方便連續新增；
//           輸入框是空的時候失去焦點，就變回動作列（有字的時候不收，打到一半的字不會不見）
const adding = ref(false)
const input = ref<HTMLInputElement | null>(null)

async function startAdding() {
  adding.value = true
  await nextTick()
  input.value?.focus()
}

function onInputBlur() {
  if (!draft.value.trim()) {
    draft.value = ''
    adding.value = false
  }
}

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
  if (!name || !canCreate.value || saving.value) return
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
  // 維持輸入狀態：點了「新增」按鈕的話焦點在按鈕上，拉回輸入框
  input.value?.focus()
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

    <!-- 最下面一列：新增風味詞。平常是動作列，點了變成輸入列（見 script 的 adding） -->
    <button
      v-if="!adding"
      type="button"
      class="card-pad-x tag-row add-row w-full text-left"
      :style="{ color: 'var(--accent-text)' }"
      @click="startAdding"
    >
      <!-- Lucide 的 plus（《03》§3 的「新增 ＋」） -->
      <svg
        width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" class="shrink-0"
        fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"
      >
        <path d="M5 12h14" />
        <path d="M12 5v14" />
      </svg>
      <span class="text-heading-m">新增風味詞</span>
    </button>
    <div v-else class="card-pad-x tag-row add-row">
      <!-- min-w-0 不可省略：輸入框預設 size="20" 的最小寬度會把按鈕擠出卡片 -->
      <input
        ref="input"
        v-model="draft"
        type="text"
        placeholder="輸入風味詞"
        aria-label="新增風味詞"
        enterkeyhint="done"
        class="sheet-input min-w-0 flex-1 text-left"
        @keydown.enter.prevent="create"
        @blur="onInputBlur"
      >
      <AppButton
        :busy="saving"
        :disabled="!canCreate"
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
  min-height: var(--sheet-row-h);
  padding-block: 0.75rem;
  /* 分隔線不另外佔 1px，列高才會是 --sheet-row-h */
  box-shadow: inset 0 1px 0 var(--border);
}
/* 新增風味詞那一列（動作列與輸入列）是單行的列：固定 --sheet-row-h，兩種狀態切換時高度不跳 */
.add-row {
  height: var(--sheet-row-h);
  padding-block: 0;
  gap: 0.5rem;
}
</style>
