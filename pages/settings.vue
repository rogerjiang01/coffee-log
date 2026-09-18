<script setup lang="ts">
// 設定：帳號與登出。
//
// 「記錄停水時間」的入口只有一個，在沖煮表單的分段注水區（《02》§5 區塊三）。
// 這裡不再放第二個控制點：同一個偏好兩個入口要同步、文案要一致、
// 改行為要記得改兩次，而「使用者不在填表時為什麼會想關掉時間欄位」
// 這個情境想不出來。
//
// 檢視型畫面（《03》§3）：左上 ‹ 回首頁（設定只從首頁的齒輪進來），分頁列保留。

definePageMeta({ screen: 'view' })

const supabase = useSupabaseClient()
const user = useSupabaseUser()

const signingOut = ref(false)

async function signOut() {
  signingOut.value = true
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <main class="mx-auto px-5 py-10" :style="{ maxWidth: 'var(--content-max)' }">
    <PageHeader title="設定" back="/" />

    <section class="mt-8">
      <h2 class="text-sm text-muted">帳號</h2>
      <p class="mt-1">{{ user?.email }}</p>
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
  </main>
</template>
