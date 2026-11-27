<script setup lang="ts">
// 設定：帳號與登出。
//
// 「記錄停水時長」的入口只有一個，在沖煮表單的分段注水區（《02》§5 區塊三）。
// 這裡不再放第二個控制點：同一個偏好兩個入口要同步、文案要一致、
// 改行為要記得改兩次，而「使用者不在填表時為什麼會想關掉停水時長」
// 這個情境想不出來。
//
// 檢視型畫面（《03》§3）：左上 ‹ 回上一頁，沒有上一頁時回總覽（父層），分頁列保留。

definePageMeta({ screen: 'view' })

const supabase = useSupabaseClient()
const session = useSupabaseSession()
const user = useSupabaseUser()
// 先看 session：claims 在換帳號後要等另一趟 getClaims() 才換，那之前會是上一個人的信箱。
// 整頁載入時 session 沒有 user（伺服器端刪掉了），那時 claims 是新的（見 useCurrentUserId）
const email = computed(() =>
  (session.value as { user?: { email?: string } } | null)?.user?.email ?? user.value?.email ?? '')

const cache = useQueryCache()
const splash = useSplash()
const signingOut = ref(false)

async function signOut() {
  signingOut.value = true
  // 暫存先清再登出：共用裝置上，下一個人登入不該看到前一個人填到一半的內容。
  // 文字在 localStorage、照片在 IndexedDB，兩邊都清。清不掉也照樣登出
  try {
    clearAllDrafts(localStorage)
  }
  catch {
    // 私密瀏覽等情境讀不到 localStorage：那裡本來就沒有暫存
  }
  await draftPhotos.clear()
  await supabase.auth.signOut()
  // 查詢快取在登出之後才清：登出前清掉的話，這段空檔裡還掛著的頁面會用舊 session 重抓回來
  cache.clear()
  // 登入頁演一次和打開 App 時相同的開場（《03》§6.1）：先挑首圖、等它解碼（最多 0.5 秒）再導向
  await splash.prepareLoginIntro()
  await navigateTo('/login')
}
</script>

<template>
  <main class="mx-auto px-5 pt-10" :style="{ maxWidth: 'var(--content-max)' }">
    <!-- 返回是頁首的圓鈕（PageHeader → BackButton，2026-11-27） -->
    <PageHeader title="設定" :back="SETTINGS_BACK_FALLBACK" />

    <!-- 2026-11-27（Figma「設定（草稿）」3670:1787）：段落標題「帳號」＋一張只有一列的唯讀卡片，下面是登出。
         頁首、段落、按鈕之間都是 --gap-section，和詳情頁相同 -->
    <div class="flex flex-col" :style="{ marginTop: 'var(--gap-section)', gap: 'var(--gap-section)' }">
      <FormSection title="帳號">
        <!-- 只有一列、獨立成一張卡片：膠囊形（FormCard pill，28px），和豆子詳情的「已喝完」同一種。
             唯讀列（ReadonlyRow）：上下內距固定，信箱換行時列跟著長高、圓角不變 -->
        <FormCard pill>
          <dl>
            <ReadonlyRow label="電子郵件">
              <!-- 信箱沒有空格：任意字元都可以斷行（wrap-anywhere），不截斷；值靠右（ReadonlyRow） -->
              <span class="min-w-0 wrap-anywhere">{{ email }}</span>
            </ReadonlyRow>
          </dl>
        </FormCard>
      </FormSection>

      <!-- 滿寬的外框按鈕：56px、膠囊形（AppButton 的 block，《03》§4.18） -->
      <AppButton variant="outline" block
        :busy="signingOut"
        @click="signOut"
      >
        {{ signingOut ? '登出中' : '登出' }}
      </AppButton>
    </div>
  </main>
</template>
