<script setup lang="ts">
// 開關（《03》§4.10 狀態表現，Figma 的 toggle 與 Sheet Row 的 toggle）。
//
// 表達的是狀態不是動作：標籤固定不變，開關位置本身說明目前狀態。
// 用 role="switch" 而不是 aria-pressed 的按鈕——前者輔助技術會讀成
// 「開／關」，後者讀成「已按下」，語意不同。
//
// **整列都是按鈕**：軌道只有 64×26，可點範圍是整列（至少 44px 高，《03》§7）。
// 放在卡片的一列裡用（FormRow 或 AppCard），自己不畫框。

defineProps<{
  modelValue: boolean
  label: string
  busy?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [boolean] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :disabled="busy"
    class="flex w-full items-center justify-between gap-3 text-left disabled:opacity-60"
    :style="{ minHeight: 'var(--touch-min)' }"
    @click="emit('update:modelValue', !modelValue)"
  >
    <span class="sheet-label">{{ label }}</span>

    <!-- 軌道與圓鈕。關閉的軌道用 --control-inactive（照 Figma，2026-11-13 決定）：
         開關尺寸大，靠圓鈕與軌道的形狀就看得出可以操作，不必靠軌道的深淺。
         **不用 --control-empty**，那是未選取的輪廓用的 -->
    <span
      class="relative inline-block shrink-0 rounded-full"
      :style="{
        width: '64px',
        height: '26px',
        background: modelValue ? 'var(--accent)' : 'var(--control-inactive)',
        transition: 'background var(--motion-duration) var(--motion-ease)',
      }"
      aria-hidden="true"
    >
      <span
        class="absolute rounded-full"
        :style="{
          top: '2px',
          width: '36px',
          height: '22px',
          background: 'var(--control-thumb)',
          left: modelValue ? '26px' : '2px',
          transition: 'left var(--motion-duration) var(--motion-ease)',
        }"
      />
    </span>
  </button>
</template>
