<script setup lang="ts">
// 全域錯誤頁。沒有這一頁的話，任何未被接住的例外就是整片白畫面——
// 使用者不會回報「哪一頁出錯」，只會說「打不開」然後不再打開。
//
// 文案依《03-介面規範》§5.3：說明發生什麼、怎麼處理，不道歉也不含糊。
// **不顯示 stack trace。** 它對使用者沒有意義，而且可能帶出內部路徑。
// 改成給一組短代碼——同一個錯誤每次都算出同一組，回報時對得起來。

const props = defineProps<{
  error: { statusCode?: number, statusMessage?: string, message?: string }
}>()

const notFound = computed(() => props.error?.statusCode === 404)

// 代碼的算法抽到 utils/errorMessage.ts，那裡有測試守著——
// 這一頁本身是登入牆後面的，我沒辦法自動走到它。
const code = computed(() => errorReportCode(props.error))

// clearError 會把錯誤狀態清掉再導頁，直接用 NuxtLink 的話錯誤會留著
function goHome() {
  clearError({ redirect: '/' })
}

function reload() {
  if (import.meta.client) window.location.reload()
}
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh flex-col justify-center px-5 py-12"
    :style="{ maxWidth: 'var(--content-max-narrow)' }"
  >
    <h1 class="font-serif text-xl font-bold">
      {{ notFound ? '找不到這個頁面' : '這一頁沒有載入成功' }}
    </h1>

    <p class="mt-3 text-sm">
      <template v-if="notFound">
        網址可能打錯了，或這筆資料已經被刪除。
      </template>
      <template v-else>
        已經記錄的資料沒有受影響。重新載入通常就會好；如果一直出現同一組代碼，把它回報給我們。
      </template>
    </p>

    <div class="mt-8 flex flex-col gap-3">
      <button
        type="button"
        class="w-full rounded-sm px-4 py-3 font-medium"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }"
        @click="goHome"
      >
        回首頁
      </button>
      <button
        v-if="!notFound"
        type="button"
        class="w-full rounded-sm border px-4 py-3"
        :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
        @click="reload"
      >
        重新載入
      </button>
    </div>

    <p v-if="!notFound" class="mt-8 text-xs tabular-nums text-muted">
      錯誤代碼 {{ code }}
    </p>
  </main>
</template>
