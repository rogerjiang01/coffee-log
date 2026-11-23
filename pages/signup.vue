<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()

// 綠底模式（《03》§2.2「綠底模式」）。掛在 <html> 上，頁面底色與焦點框才會跟著換；
// 離開這一頁時 useHead 會自己把 class 拿掉。
useHead({ htmlAttrs: { class: 'theme-green' } })

const email = ref('')
const password = ref('')
const error = ref('')
// 哪一格沒填好：訊息顯示在那一格的卡片下方，標籤右邊加 circle-alert（表單的列的做法）。其他錯誤（帳密不對、連線）顯示在按鈕上方
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
        <!-- 每個欄位各自一張單列卡片（2026-11-23，Figma 的 login 新版）：和表單同一個元件（FormCard pill ＋ FormRow），
             左邊欄位名稱、右邊輸入，56px、膠囊形 28px，卡片之間 12px。綠底模式下卡片不畫外框（FormCard）。
             提示字照表單的規則「輸入＋欄位名」，顏色是 --text-muted（帶有必要資訊，《03》§4.1）。
             錯誤照表單的列：標籤右邊 circle-alert，訊息在那張卡片下方（FormNote），輸入框用 aria-describedby 指過去。
           **每個錯誤只有一個圖示**（2026-11-23）：欄位的錯誤圖示在標籤旁，所以卡片下方的訊息不再畫（:icon="false"）；
           不屬於欄位的錯誤（帳密、連線）圖示在訊息前面。綠底上文字是 --danger（coral-50）、圖示是 --danger-icon（coral-200） -->
        <div class="flex flex-col gap-3">
          <FormCard pill>
            <FormRow label="電子郵件" for="email" :error="!!fieldError.email">
              <SheetText
                id="email"
                v-model="email"
                type="email"
                autocomplete="email"
                inputmode="email"
                autocapitalize="off"
                spellcheck="false"
                placeholder="輸入電子郵件"
                :aria-invalid="!!fieldError.email || undefined"
                :aria-describedby="fieldError.email ? 'email-error' : undefined"
              />
            </FormRow>
            <FormNote v-if="fieldError.email" id="email-error" tone="error" :icon="false">{{ fieldError.email }}</FormNote>
          </FormCard>

          <FormCard pill>
            <FormRow label="密碼" for="password" :error="!!fieldError.password">
              <SheetText
                id="password"
                v-model="password"
                type="password"
                autocomplete="new-password"
                placeholder="輸入密碼"
                :aria-invalid="!!fieldError.password || undefined"
                :aria-describedby="fieldError.password ? 'password-error' : 'password-hint'"
              />
            </FormRow>
            <FormNote v-if="fieldError.password" id="password-error" tone="error" :icon="false">{{ fieldError.password }}</FormNote>
            <!-- 參考資訊（--text-muted）。出錯時只顯示錯誤：錯誤訊息本身就是「密碼至少 6 個字元」 -->
            <FormNote v-else id="password-hint">至少 6 個字元</FormNote>
          </FormCard>
        </div>

        <p v-if="error" role="alert" class="mt-4 flex items-start gap-1.5 text-sm" :style="{ color: 'var(--danger)' }">
          <AlertIcon class="mt-0.5" :style="{ color: 'var(--danger-icon)' }" />
          <span>{{ error }}</span>
        </p>

        <!-- 卡片到按鈕 32px，和登入頁相同 -->
        <AppButton block
          type="submit"
          :busy="sending"
          class="mt-8"
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
