<script setup lang="ts">
    // 強度選擇器（《03-介面規範》§4.3、《02-功能規格》§5 區塊四）。
    //
    // 四個維度只描述強度，不評價好壞——文案不得出現「評分」「分數」「幾分」。
    // 好壞交給愛心與心得筆記。
    //
    // 一次點擊完成，不用滑桿（手機上難精準）、不用下拉（需兩次操作）。
    // 全站一致採「被選中的點與其左側一併填實」表達強度累進。
    // 未選取要明顯是「可以不填」，不用紅色、驚嘆號或任何催促性的視覺。

    // Intensity 定義在 utils/brew.ts，由 Nuxt 自動匯入

    const props = defineProps<{ modelValue: Intensity }>();
    const emit = defineEmits<{ "update:modelValue": [Intensity] }>();

    const dimensions: { key: keyof Intensity; label: string }[] = [
        { key: "acidity", label: "酸質" },
        { key: "sweetness", label: "甜感" },
        { key: "body", label: "醇厚" },
        { key: "bitterness", label: "苦味" },
    ];

    const levels = [1, 2, 3, 4, 5];

    function pick(key: keyof Intensity, level: number) {
        const next = { ...props.modelValue };
        // 再點一次同一個點就清掉，四個維度都可以留空
        if (next[key] === level) delete next[key];
        else next[key] = level;
        emit("update:modelValue", next);
    }
</script>

<template>
    <section>
        <p class="text-sm">強度</p>
        <p class="text-xs text-muted">描述強弱，不是好壞</p>

        <!-- 「弱／強」只標一次，在四列圓點的上方、與圓點欄對齊。
         原本每一列兩端各標一次：標籤 40 ＋ 弱 ＋ 五個 44 的觸控區 ＋ 強，
         375px 下需要 320px 以上，卡片內只有 301px，右端的「強」被切掉。
         四列的意思相同，逐列重複也是雜訊。 -->
        <div class="mt-5 flex items-center gap-3">
            <span class="w-10 shrink-0" />
            <div class="flex flex-1 justify-between text-xs" :style="{ color: 'var(--text-muted)' }">
                <span class="text-center" :style="{ minWidth: 'var(--touch-min)' }">弱</span>
                <span class="text-center" :style="{ minWidth: 'var(--touch-min)' }">強</span>
            </div>
        </div>

        <div v-for="dimension in dimensions" :key="dimension.key" class="mt-3 flex items-center gap-3">
            <span class="w-10 shrink-0 text-sm">{{ dimension.label }}</span>

            <div class="flex flex-1 justify-between" role="radiogroup" :aria-label="dimension.label">
                <button v-for="level in levels" :key="level" type="button" role="radio" :aria-checked="modelValue[dimension.key] === level" :aria-label="`${dimension.label} ${level}`" class="flex items-center justify-center" :style="{ minWidth: 'var(--touch-min)', minHeight: 'var(--touch-min)' }" @click="pick(dimension.key, level)">
                    <!-- 觸控區 --touch-min，圓點視覺可以小 -->
                    <span
                        class="block size-4 rounded-full border"
                        :style="{
                            borderColor: (modelValue[dimension.key] ?? 0) >= level ? 'var(--accent)' : 'var(--border)',
                            background: (modelValue[dimension.key] ?? 0) >= level ? 'var(--accent)' : 'transparent',
                            transition: 'background var(--motion-duration) var(--motion-ease)',
                        }"
                    />
                </button>
            </div>
        </div>
    </section>
</template>
