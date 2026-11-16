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
  <!-- 版面照 Figma 的 login：首圖、綠色漸層、logo、300px 寬的表單（AuthShell）。
       「忘記密碼」先隱藏，等接上自己的 SMTP 再打開（CLAUDE.md「暫緩」） -->
  <AuthShell>
    <h1 class="sr-only">登入</h1>

    <form novalidate @submit.prevent="submit">
      <div class="flex flex-col gap-4">
        <!-- 有框的輸入框（《03》§4.1）：登入、註冊不在卡片裡 -->
        <TextField
          id="email"
          v-model="email"
          label="電子郵件"
          type="email"
          autocomplete="email"
          placeholder="example@email.com"
          example
          :error="fieldError.email"
        />

        <!-- 密碼不放提示字（Figma 寫的「Password」不照抄） -->
        <TextField
          id="password"
          v-model="password"
          label="密碼"
          type="password"
          autocomplete="current-password"
          :error="fieldError.password"
        />
      </div>

      <p v-if="error" role="alert" class="mt-4 flex items-start gap-1.5 text-sm" :style="{ color: 'var(--danger)' }">
        <AlertIcon class="mt-0.5" />
        <span>{{ error }}</span>
      </p>

      <AppButton block
        type="submit"
        :busy="sending"
        class="mt-10"
      >
        {{ sending ? '登入中' : '登入' }}
      </AppButton>
    </form>

    <p class="mt-3 flex items-center gap-1">
      還沒有帳號嗎？
      <AppButton variant="text" to="/signup">註冊</AppButton>
    </p>
  </AuthShell>
</template>
