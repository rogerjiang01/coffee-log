<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const email = ref('')
const password = ref('')
const error = ref('')
const sending = ref(false)
// 專案若開著信箱確認，註冊不會直接給 session，此時改顯示已寄信
const mailSent = ref(false)

watchEffect(() => {
  if (user.value) navigateTo('/')
})

function translate(message: string) {
  if (message.includes('already registered')) return '這個信箱已經註冊過了，直接登入就好'
  if (message.includes('Password should be at least')) return '密碼至少 6 個字元'
  if (message.includes('invalid format') || message.includes('Unable to validate email'))
    return '這個信箱格式看起來不對'
  if (message.includes('Signups not allowed')) return '這個專案目前關閉註冊'
  return message
}

async function submit() {
  error.value = ''

  if (!email.value.trim()) return (error.value = '填一下電子郵件')
  if (!password.value) return (error.value = '填一下密碼')
  if (password.value.length < 6) return (error.value = '密碼至少 6 個字元')

  sending.value = true
  const { data, error: err } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
  })
  sending.value = false

  if (err) return (error.value = translate(err.message))

  // 有 session 代表信箱確認是關的，直接進站；否則等使用者去收信
  if (data.session) await navigateTo('/')
  else mailSent.value = true
}
</script>

<template>
  <main class="mx-auto px-5 py-12" :style="{ maxWidth: '26rem' }">
    <template v-if="mailSent">
      <h1 class="font-serif text-xl font-bold">確認信寄出了</h1>
      <p class="mt-4">
        我們寄了一封信到 {{ email }}，點裡面的連結就完成註冊。
      </p>
      <p class="mt-2 text-sm text-muted">
        確認完再回來登入。
      </p>
      <NuxtLink
        to="/login"
        class="mt-7 block w-full rounded-sm px-4 py-3 text-center font-medium"
        :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
      >
        去登入
      </NuxtLink>
    </template>

    <template v-else>
      <h1 class="font-serif text-xl font-bold">註冊</h1>

      <form class="mt-8" novalidate @submit.prevent="submit">
        <label class="block text-sm" for="email">電子郵件</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
        >

        <label class="mt-5 block text-sm" for="password">密碼</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="new-password"
          class="mt-1 block w-full rounded-sm border px-3 py-2.5"
          :style="{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '44px' }"
        >
        <p class="mt-1 text-xs text-muted">至少 6 個字元</p>

        <p v-if="error" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
          {{ error }}
        </p>

        <button
          type="submit"
          :disabled="sending"
          class="mt-7 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60"
          :style="{ background: 'var(--accent)', color: '#FFFFFF', minHeight: '44px' }"
        >
          {{ sending ? '註冊中' : '註冊' }}
        </button>
      </form>

      <p class="mt-8 text-sm text-muted">
        已經有帳號？
        <NuxtLink to="/login" class="underline" :style="{ color: 'var(--accent)' }">
          去登入
        </NuxtLink>
      </p>
    </template>
  </main>
</template>
