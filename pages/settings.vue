<script setup lang="ts">
// 設定：帳號、記錄分段時間、登出。
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// 記錄分段時間（《02》§5 區塊三）。預設關閉；只影響沖煮表單顯不顯示時間欄位，
// 不影響任何已記錄的時間。說明文字只講它是什麼，不寫成勸誘或警告。
const {
  enabled: recordStepTimes,
  loaded: prefLoaded,
  saving: prefSaving,
  error: prefError,
  set: setRecordStepTimes,
} = useRecordStepTimes()

const signingOut = ref(false)

async function signOut() {
  signingOut.value = true
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <h1 class="font-serif text-xl font-bold">設定</h1>

    <section class="mt-8">
      <h2 class="text-sm text-muted">帳號</h2>
      <p class="mt-1">{{ user?.email }}</p>
    </section>

    <section class="mt-8">
      <h2 class="text-sm text-muted">沖煮紀錄</h2>
      <div class="mt-2 flex items-start justify-between gap-4">
        <div class="min-w-0">
          <p id="pref-step-times">記錄分段時間</p>
          <p id="pref-step-times-note" class="mt-1 text-sm text-muted">
            進階參數。停水時間會影響各段風味在口中的比重。
          </p>
        </div>
        <!-- toggle 在這裡是對的：它是獨立的開關，沒有互斥的副作用（《03》§4.0.1）。
             讀到設定之前不可按，否則會拿預設的「關」去蓋掉已經打開的人 -->
        <button
          type="button"
          role="switch"
          :aria-checked="recordStepTimes"
          aria-labelledby="pref-step-times"
          aria-describedby="pref-step-times-note"
          :disabled="!prefLoaded || prefSaving"
          class="switch shrink-0"
          :class="{ 'is-on': recordStepTimes }"
          @click="setRecordStepTimes(!recordStepTimes)"
        >
          <span class="switch-track" aria-hidden="true"><span class="switch-thumb" /></span>
        </button>
      </div>
      <p v-if="prefError" role="alert" class="mt-2 text-sm" :style="{ color: 'var(--danger)' }">{{ prefError }}</p>
    </section>

    <button
      type="button"
      :disabled="signingOut"
      class="mt-8 rounded-sm border px-4 py-3 font-medium disabled:opacity-60"
      :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: 'var(--touch-min)' }"
      @click="signOut"
    >
      {{ signingOut ? '登出中' : '登出' }}
    </button>

    <p class="mt-8 text-sm text-muted">
      <NuxtLink to="/" class="underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
    </p>
  </main>
</template>

<style scoped>
/* 觸控目標 44×44（--touch-min），看得到的軌道比它小 */
.switch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: var(--touch-min);
  min-height: var(--touch-min);
}
.switch:disabled {
  opacity: 0.6;
}
.switch-track {
  position: relative;
  display: block;
  width: 44px;
  height: 26px;
  border-radius: 999px;
  background: var(--border-strong);
  transition: background-color var(--motion-duration) var(--motion-ease);
}
.switch-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  background: var(--surface);
  transition: transform var(--motion-duration) var(--motion-ease);
}
.switch.is-on .switch-track {
  background: var(--accent);
}
.switch.is-on .switch-thumb {
  transform: translateX(18px);
}
</style>
