<script setup lang="ts">
    // 隔了一段時間之後的還原詢問。
    //
    // 用 overlay 是刻意的：這時使用者的意圖不明——可能是要接著填，
    // 也可能是要記新的一杯。擋住畫面、強制回應，正是「我不知道你要哪個」
    // 的正確表達。短時間離開時不用這個，因為那時意圖是明確的。

    const props = defineProps<{
        open: boolean;
        note?: string;
    }>();

    defineEmits<{ accept: []; discard: [] }>();

    const dialog = ref<HTMLDialogElement | null>(null);

    watch(
        () => props.open,
        (value) => {
            if (!dialog.value) return;
            if (value && !dialog.value.open) dialog.value.showModal();
            if (!value && dialog.value.open) dialog.value.close();
        },
        { immediate: true },
    );

    onMounted(() => {
        if (props.open && dialog.value && !dialog.value.open) dialog.value.showModal();
    });
</script>

<template>
    <dialog ref="dialog" class="w-[calc(100vw-2.5rem)] max-w-sm rounded-lg p-6 backdrop:bg-[var(--overlay-scrim)]" :style="{ background: 'var(--surface)', color: 'var(--text)', boxShadow: 'var(--overlay-shadow)' }" @cancel.prevent>
        <h2 class="font-serif text-lg font-bold">上次有一筆沒存完，要繼續填寫嗎？</h2>
        <p v-if="note" class="mt-3 text-sm text-muted">{{ note }}</p>

        <div class="mt-6 flex gap-3">
            <button type="button" class="flex-1 rounded-sm border px-4 py-3" :style="{ borderColor: 'var(--border-strong)', minHeight: 'var(--touch-min)' }" @click="$emit('discard')">重新開始</button>
            <button type="button" class="flex-1 rounded-sm px-4 py-3 font-medium" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }" @click="$emit('accept')">繼續填寫</button>
        </div>
    </dialog>
</template>
