<script setup lang="ts">
// 器材型錄的可搜尋下拉，行為與查表欄位一致（《02》§10）。
//
// 型錄是唯讀的系統表，因此沒有「新增」那一列——自建器材走 custom_name。

// CatalogRow 與 catalogDisplayName 定義在 utils/equipment.ts，由 Nuxt 自動匯入

const props = defineProps<{
  modelValue: string | null
  type: EquipmentType
}>()

const emit = defineEmits<{
  'update:modelValue': [string | null]
  'selected': [CatalogRow | null]
}>()

const supabase = useSupabaseClient()

const items = ref<CatalogRow[]>([])
const loading = ref(true)
const open = ref(false)
const query = ref('')
const root = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)

const selected = computed(() => items.value.find(item => item.id === props.modelValue) ?? null)

// 借用查表欄位的過濾邏輯，把型錄列映射成同樣的形狀
const matches = computed(() =>
  filterLookup(
    query.value,
    items.value.map(row => ({ id: row.id, name: catalogDisplayName(row), aliases: [row.brand, row.model], user_id: null })),
  ).map(match => items.value.find(row => row.id === match.id)!).filter(Boolean),
)

async function load() {
  loading.value = true
  try {
    const { data } = await supabase
      .from('equipment_catalog')
      .select('id, brand, model, variant, grind_scale_min, grind_scale_max, grind_scale_increment, grind_scale_suggested_min, grind_scale_suggested_max, grind_scale_note')
      .eq('type', props.type)
      .order('sort_order')
      .order('model')
    items.value = (data ?? []) as unknown as CatalogRow[]
  }
  finally {
    // finally：任何失敗都不能讓元件停在「讀取中」
    loading.value = false
  }
}

onMounted(() => {
  load()
  document.addEventListener('click', onDocumentClick)
})
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick))
watch(() => props.type, () => {
  emit('update:modelValue', null)
  emit('selected', null)
  load()
})

const { style: panelStyle, isOutside } = useAnchoredPanel(root, panel, open)

function onDocumentClick(event: MouseEvent) {
  // 浮層已 teleport 到 body，不能只檢查觸發元素的父層
  if (open.value && isOutside(event.target as Node)) close()
}

async function toggle() {
  open.value = !open.value
  if (open.value) {
    query.value = ''
    await nextTick()
    // preventScroll：取得焦點時不要把畫面捲到這個欄位
    searchInput.value?.focus({ preventScroll: true })
  }
}

function close() {
  open.value = false
  query.value = ''
}

function pick(row: CatalogRow | null) {
  emit('update:modelValue', row?.id ?? null)
  emit('selected', row)
  close()
}
</script>

<template>
  <div ref="root" class="relative">
    <label class="block text-sm" for="catalog-select">型號</label>

    <button
      id="catalog-select"
      type="button"
      role="combobox"
      :aria-expanded="open"
      :disabled="loading"
      class="mt-1 flex w-full items-center justify-between field px-3 py-2.5 text-left"
      data-field
      :data-filled="!!selected"
      :style="{ minHeight: '44px' }"
      @click="toggle"
    >
      <span :style="{ color: selected ? 'var(--text)' : 'var(--text-muted)' }">
        {{ selected ? catalogDisplayName(selected) : '選填' }}
      </span>
      <svg
        width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"
        :style="{
          color: 'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform var(--motion-duration) var(--motion-ease)',
        }"
      >
        <path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="z-40 flex flex-col overflow-hidden rounded-sm border"
        :style="{ ...panelStyle, borderColor: 'var(--border)', background: 'var(--surface)', boxShadow: 'var(--overlay-shadow)' }"
        @keydown.esc="close"
      >
        <div class="shrink-0 border-b p-2" :style="{ borderColor: 'var(--border)' }">
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="打字找找看"
            class="block w-full field px-3 py-2"
            :style="{ minHeight: '44px' }"
          >
        </div>

        <ul class="min-h-0 flex-1 overflow-y-auto">
          <li v-if="modelValue">
            <button
              type="button"
              class="block w-full px-3 py-2 text-left text-sm"
              :style="{ minHeight: '44px', color: 'var(--text-muted)' }"
              @click="pick(null)"
            >
              清除
            </button>
          </li>
          <li v-for="row in matches" :key="row.id">
            <button
              type="button"
              class="block w-full px-3 py-2 text-left"
              :style="{ minHeight: '44px', background: row.id === modelValue ? 'var(--accent-wash)' : undefined }"
              @click="pick(row)"
            >
              {{ catalogDisplayName(row) }}
            </button>
          </li>
          <li v-if="!matches.length" class="px-3 py-3 text-sm text-muted">
            型錄裡沒有，用下面的自訂名稱
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>