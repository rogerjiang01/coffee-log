<script setup lang="ts">
// 分享的失效畫面（《02》§7.2、《03》§4.13.5）。
//
// 紀錄已刪除、代碼不存在，兩種情況同一個畫面、同一句話，不分原因——
// 分原因等於告訴逐一試代碼的人哪些代碼曾經存在。底下也不多寫一行解釋。
// 版面與 error.vue 同一套。

defineProps<{ signedIn: boolean }>()
</script>

<template>
  <main
    class="mx-auto flex min-h-dvh flex-col justify-center px-5 py-12"
    :style="{ maxWidth: 'var(--content-max-narrow)' }"
  >
    <h1 class="font-serif text-xl font-bold">這筆分享已經無法查看</h1>
    <!-- 未登入時不放任何按鈕：他沒有可以去的地方，「回首頁」會把他帶到登入頁 -->
    <NuxtLink
      v-if="signedIn"
      to="/"
      class="mt-8 flex w-full items-center justify-center rounded-sm border px-4 py-3"
      :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }"
    >
      回首頁
    </NuxtLink>
  </main>
</template>
