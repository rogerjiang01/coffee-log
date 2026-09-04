<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const email = ref('')
const password = ref('')
const error = ref('')
const sending = ref(false)

// 已登入者不該停在登入頁
watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function submit() {
  error.value = ''

  if (!email.value.trim()) return (error.value = '填一下電子郵件')
  if (!password.value) return (error.value = '填一下密碼')

  sending.value = true
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })
  sending.value = false

  if (err) return (error.value = errorText(err))
  await navigateTo('/')
}
</script>

<template>
  <main class="mx-auto px-5 py-12" :style="{ maxWidth: '26rem' }">
    <h1 class="font-serif text-xl font-bold">登入</h1>

    <form class="mt-8" novalidate @submit.prevent="submit">
      <label class="block text-sm" for="email">電子郵件</label>
      <input
        id="email"
        v-model="email"
        type="email"
        autocomplete="email"
        class="mt-1 block w-full field px-3 py-2.5"
        :style="{ minHeight: '44px' }"
      >

      <label class="mt-5 block text-sm" for="password">密碼</label>
      <input
        id="password"
        v-model="password"
        type="password"
        autocomplete="current-password"
        class="mt-1 block w-full field px-3 py-2.5"
        :style="{ minHeight: '44px' }"
      >

      <p v-if="error" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
        {{ error }}
      </p>

      <button
        type="submit"
        :disabled="sending"
        class="mt-7 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
        :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: '44px' }"
      >
        {{ sending ? '登入中' : '登入' }}
      </button>
    </form>

    <p class="mt-8 text-sm text-muted">
      還沒有帳號？
      <NuxtLink to="/signup" class="underline" :style="{ color: 'var(--accent)' }">
        註冊
      </NuxtLink>
    </p>
  </main>
</template>
