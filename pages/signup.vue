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
// 專案若開著信箱確認，註冊不會直接給 session，此時改顯示已寄信
const mailSent = ref(false)

watchEffect(() => {
  if (user.value) navigateTo('/')
})

async function submit() {
  error.value = ''
  fieldError.value = {}

  if (!email.value.trim()) return (fieldError.value = { email: '電子郵件尚未填寫' })
  if (!password.value) return (fieldError.value = { password: '密碼尚未填寫' })
  if (password.value.length < 6) return (fieldError.value = { password: '密碼至少 6 個字元' })

  sending.value = true
  const { data, error: err } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
  })
  sending.value = false

  if (err) return (error.value = errorText(err))

  // 有 session 代表信箱確認是關的，直接進站；否則等使用者去收信
  if (data.session) await navigateTo('/')
  else mailSent.value = true
}
</script>

<template>
  <!-- 沿用登入頁的版面（AuthShell）。Figma 沒有畫註冊頁 -->
  <AuthShell>
    <template v-if="mailSent">
      <h1 class="text-display-s font-medium">確認信寄出了</h1>
      <p class="mt-4">
        確認信已寄到 {{ email }}。
      </p>
      <p class="mt-2 text-sm text-muted">
        點信中的連結完成註冊後，再回來登入。
      </p>
      <AppButton block
        to="/login"
        class="mt-10"
      >
        去登入
      </AppButton>
    </template>

    <template v-else>
      <h1 class="sr-only">註冊</h1>

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

          <div>
            <TextField
              id="password"
              v-model="password"
              label="密碼"
              type="password"
              autocomplete="new-password"
              :error="fieldError.password"
            />
            <p v-if="!fieldError.password" class="mt-1 text-sm text-muted">至少 6 個字元</p>
          </div>
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
          {{ sending ? '註冊中' : '註冊' }}
        </AppButton>
      </form>

      <p class="mt-3 flex items-center gap-1">
        已經有帳號？
        <AppButton variant="text" to="/login">去登入</AppButton>
      </p>
    </template>
  </AuthShell>
</template>
