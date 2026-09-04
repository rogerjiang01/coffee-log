<script setup lang="ts">
// 短時間離開後自動填入的告知橫幅。
//
// 用 sticky 而不是自動捲動：使用者原本在哪個位置是他的位置，
// 強制移動會讓他失去方向感。橫幅跟著捲動就解決了可見性。
//
// 沒有東西需要他決定，所以不擋畫面。「全部清除」是次要動作，不用強調色。
//
// **淡出綁捲動位置，不綁計時器。** 定時消失的問題是使用者可能正在滑
// 別的地方，回頭發現橫幅不見了，「全部清除」這條退路也跟著消失。
// 綁捲動位置則與他的行為對應：需要時捲回頂部就在。

defineProps<{ note?: string }>()
defineEmits<{ clearAll: [] }>()

// 24px：手指或滑鼠的細微晃動不該讓橫幅閃爍，離開頂部才算離開
const HIDE_AFTER_PX = 24

const atTop = ref(true)

// rAF 節流：捲動事件一次捲動會發幾十次，但每幀重算一次就夠了
let frame = 0
function onScroll() {
  if (frame) return
  frame = requestAnimationFrame(() => {
    frame = 0
    atTop.value = window.scrollY <= HIDE_AFTER_PX
  })
}

onMounted(() => {
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
})

onBeforeUnmount(() => {
  if (frame) cancelAnimationFrame(frame)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <!-- 淡出時一併關掉 pointer-events 與可及性樹：看不見的「全部清除」
       不該被點到，也不該被螢幕閱讀器唸到。
       高度保留著，所以淡回來時不會把下面的內容推開。 -->
  <div
    class="draft-banner sticky top-0 z-20 -mx-5 flex items-center gap-3 border-b px-5 py-3"
    :class="{ 'is-hidden': !atTop }"
    :style="{ borderColor: 'var(--border)', background: 'var(--accent-wash)' }"
    :aria-hidden="!atTop"
    :inert="!atTop"
    role="status"
  >
    <span class="min-w-0 flex-1 text-sm" :style="{ color: 'var(--on-accent-wash)' }">
      未儲存的內容已恢復<template v-if="note">。{{ note }}</template>
    </span>
    <button
      type="button"
      class="shrink-0 rounded-sm border px-3 py-2 text-sm"
      :style="{ borderColor: 'var(--border-strong)', background: 'var(--surface)', minHeight: 'var(--touch-min)' }"
      @click="$emit('clearAll')"
    >
      全部清除
    </button>
  </div>
</template>

<style scoped>
/* prefers-reduced-motion 由 main.css 的全域規則統一處理：
   transition-duration 被壓成 0.01ms，淡入淡出自動變成直接切換。
   這裡不重複寫 media query。 */
.draft-banner {
  opacity: 1;
  transition: opacity 180ms ease-out;
}

.draft-banner.is-hidden {
  opacity: 0;
  pointer-events: none;
}
</style>
