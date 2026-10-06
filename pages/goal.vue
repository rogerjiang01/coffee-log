<script setup lang="ts">
// 目標設定頁（《02》§4.4）。
//
// 全螢幕的流程型畫面：沒有分頁列、沒有 ‹、沒有「略過」。
// 已登入、還沒有任何目標時，middleware/goal-setup.global.ts 把人帶到這裡。
// 按「開始」後新增第一列目標，用取代的方式前往總覽——返回時不會再回到這一頁。
// 已經有目標的人直接打開這個網址：同樣取代成總覽。

definePageMeta({ screen: 'flow' })

const supabase = useSupabaseClient()
const userId = useCurrentUserId()
const cache = useQueryCache()

const cups = ref(GOAL_DEFAULT)
const saving = ref(false)
const error = ref('')

onMounted(async () => {
  const { data } = await supabase.from('weekly_goals').select('id').limit(1)
  if (data?.length) await navigateTo('/', { replace: true })
})

async function start() {
  if (!userId.value) {
    error.value = SESSION_EXPIRED
    return
  }
  saving.value = true
  error.value = ''
  const { error: insertError } = await supabase
    .from('weekly_goals')
    .insert({ user_id: userId.value, cups: clampGoal(cups.value) } as never)
  if (insertError) {
    saving.value = false
    error.value = `儲存失敗：${errorText(insertError)}`
    return
  }
  // middleware 之後不必再查一次
  useState<string | null>('goal-known-for').value = userId.value
  cache.invalidateAfter({ kind: 'goal' })
  await navigateTo('/', { replace: true })
}
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh flex-col px-5 pt-16 pb-10"
    :style="{ maxWidth: 'var(--content-max-narrow)' }"
  >
    <h1 class="font-serif text-2xl font-bold">設定每週記錄目標</h1>

    <div class="mt-12">
      <GoalStepper v-model="cups" />
    </div>

    <p class="mt-8 text-center text-sm text-muted">之後可以在總覽修改。</p>

    <p v-if="error" role="alert" class="mt-6 text-sm" :style="{ color: 'var(--danger)' }">{{ error }}</p>

    <button
      type="button"
      :disabled="saving"
      class="mt-auto w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
      :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
      @click="start"
    >
      開始
    </button>
  </main>
</template>
