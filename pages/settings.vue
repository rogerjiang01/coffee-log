<script setup lang="ts">
// 階段 2 只做登出。帳號相關的其餘內容之後再補。
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
    <h1 class="font-serif text-xl font-bold">設定</h1>

    <section class="mt-8">
      <h2 class="text-sm text-muted">帳號</h2>
      <p class="mt-1">{{ user?.email }}</p>
    </section>

    <button
      type="button"
      :disabled="signingOut"
      class="mt-8 rounded-sm border px-4 py-3 font-medium disabled:opacity-60"
      :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
      @click="signOut"
    >
      {{ signingOut ? '登出中' : '登出' }}
    </button>

    <p class="mt-8 text-sm text-muted">
      <NuxtLink to="/" class="underline" :style="{ color: 'var(--accent)' }">回到首頁</NuxtLink>
    </p>
  </main>
</template>
