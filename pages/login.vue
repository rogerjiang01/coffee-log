<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// 綠底模式（《03》§2.2「綠底模式」）。掛在 <html> 上，頁面底色與焦點框才會跟著換；
// 離開這一頁時 useHead 會自己把 class 拿掉。
useHead({ htmlAttrs: { class: 'theme-green' } })

const email = ref('')
const password = ref('')
const error = ref('')
// 哪一格沒填好：訊息顯示在那一格下方，框變成錯誤狀態（TextField）。其他錯誤（帳密不對、連線）顯示在按鈕上方
const fieldError = ref<{ email?: string, password?: string }>({})
const sending = ref(false)

// 已登入者不該停在登入頁
watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function submit() {
  error.value = ''
  fieldError.value = {}

  if (!email.value.trim()) return (fieldError.value = { email: '電子郵件尚未填寫' })
  if (!password.value) return (fieldError.value = { password: '密碼尚未填寫' })

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
  <main class="mx-auto px-5 py-12" :style="{ maxWidth: 'var(--content-max-narrow)' }">
    <h1 class="text-display-s font-medium">登入</h1>

    <form class="mt-8" novalidate @submit.prevent="submit">
      <!-- 有框的輸入框（《03》§4.1）：登入、註冊不在卡片裡 -->
      <TextField
        id="email"
        v-model="email"
        label="電子郵件"
        type="email"
        autocomplete="email"
        :error="fieldError.email"
      />

      <TextField
        id="password"
        v-model="password"
        class="mt-5"
        label="密碼"
        type="password"
        autocomplete="current-password"
        :error="fieldError.password"
      />

      <p v-if="error" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
        {{ error }}
      </p>

      <AppButton block
        type="submit"
        :busy="sending"
        class="mt-7"
      >
        {{ sending ? '登入中' : '登入' }}
      </AppButton>
    </form>

    <p class="mt-8 text-sm text-muted">
      還沒有帳號？
      <NuxtLink to="/signup" class="underline" :style="{ color: 'var(--accent)' }">
        註冊
      </NuxtLink>
    </p>
  </main>
</template>
