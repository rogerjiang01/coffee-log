<script setup lang="ts">
    // 器材列表（《02-功能規格》§3）。瀏覽型畫面：分頁列、右下新增，頂部只有標題（《03》§3）。
    //
    // 新增與編輯是獨立路由（/equipment/new、/equipment/[id]/edit），不再開在這一頁頂部——
    // 頁內表單沒有暫存、返回鍵會直接離開列表頁，按新增還會靜默換掉編輯中的內容。

    definePageMeta({ screen: "browse" });

    const supabase = useSupabaseClient();
    const cache = useQueryCache();

    const items = ref<UserEquipmentRow[]>([]);
    const loading = ref(true);
    const loadError = ref("");

    function displayName(row: UserEquipmentRow) {
        if (row.equipment_catalog) {
            const c = row.equipment_catalog;
            return `${c.brand} ${c.model}${c.variant ? ` ${c.variant}` : ""}`;
        }
        return row.custom_name ?? "未命名器材";
    }

    const grouped = computed(() => equipmentTypes.map((type) => ({ type, rows: items.value.filter((item) => item.type === type) })).filter((group) => group.rows.length > 0));

    // 欄位與排序走 utils/equipment.ts 的共用定義。這一頁與沖煮表單共用
    // equipment:all 這個快取 key，欄位集合不一致的話誰先跑誰決定快取內容——
    // 這裡少了 grind_scale_*，先開這一頁再去填沖煮表單，刻度提示就會印出 undefined
    async function fetchEquipment() {
        const { data, error } = await orderUserEquipment(supabase.from("user_equipment").select(USER_EQUIPMENT_SELECT));
        if (error) throw toError(error);
        return (data ?? []) as unknown as UserEquipmentRow[];
    }

    /**
     * 每台器材最後一次被用到的時間。user_equipment 沒有這個欄位，
     * 也不該有——它是衍生值（《01》§8）。
     *
     * 五個類型一次抓回來再在前端配對，不要逐台查：五個類型、每個數台，
     * 逐台查就是十幾趟來回。只取這幾個欄位與時間，列數雖多但每列很小。
     */
    async function fetchLastUsed() {
        const { data, error } = await supabase
            .from("brews")
            .select(`brewed_at, ${EQUIPMENT_COLUMNS.join(", ")}`)
            .order("brewed_at", { ascending: false });
        if (error) throw toError(error);
        return [...lastUsedFromBrews((data ?? []) as unknown as Record<string, string | null>[], EQUIPMENT_COLUMNS)] as [string, string][];
    }

    const lastUsed = ref<Map<string, string>>(new Map());

    async function load() {
        loadError.value = "";
        const { hit, settled } = cache.swr(cacheKeys.equipmentAll(), fetchEquipment, {
            apply: (rows) => {
                items.value = rows;
            },
            onError: (e) => {
                loadError.value = `讀不到器材：${errorText(e)}`;
            },
        });

        // 上次使用時間拿不到不該讓整頁失敗——它是輔助資訊，缺了就留空
        const usedQuery = cache.swr(cacheKeys.equipmentLastUsed(), fetchLastUsed, {
            apply: (pairs) => {
                lastUsed.value = new Map(pairs);
            },
        });

        loading.value = !hit;
        await Promise.all([settled, usedQuery.settled]);
        // 任何失敗都不會讓頁面停在讀取中而看不到新增入口
        loading.value = false;
    }

    onMounted(load);
</script>

<template>
    <!-- 底部留白避開浮動按鈕；分頁列的高度由 app.vue 讓出 -->
    <main class="mx-auto px-5 pt-10 pb-24" :style="{ maxWidth: 'var(--content-max)' }">
        <!-- 瀏覽型：頂部只有標題。回首頁是分頁列的事，這裡不放第二個入口 -->
        <PageHeader title="器材" />

        <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
            {{ loadError }}
        </p>

        <div v-if="loading" aria-busy="true" aria-label="讀取中" class="mt-6 space-y-6">
            <section v-for="n in 2" :key="n">
                <SkeletonBlock width="4rem" height="0.875rem" />
                <div class="mt-3 space-y-3">
                    <SkeletonBlock v-for="row in 2" :key="row" height="3.5rem" radius="4px" />
                </div>
            </section>
        </div>

        <p v-else-if="!items.length && !loadError" class="mt-6 text-muted">設定常用器材，之後新增紀錄時會自動帶入。</p>

        <div v-else class="mt-6 space-y-6">
            <section v-for="group in grouped" :key="group.type">
                <h2 class="text-sm text-muted">{{ equipmentLabels[group.type] }}</h2>
                <ul class="mt-2 space-y-3">
                    <li v-for="row in group.rows" :key="row.id" class="rounded-md border p-4" :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }">
                        <!-- 固定兩行，高度由結構決定不由內容決定。
                 左邊回答「這是什麼」（名稱 ＋ 常用標籤），右邊回答「能做什麼」（編輯）。
                 標籤緊跟名稱是因為它是名稱的修飾語，屬於身分而非動作；
                 與「編輯」並列會讓人以為標籤可以點。 -->
                        <div class="flex items-center justify-between gap-2" :style="{ minHeight: 'var(--touch-min)' }">
                            <div class="flex min-w-0 flex-1 items-center gap-2">
                                <h3 class="min-w-0 truncate font-medium">{{ displayName(row) }}</h3>
                                <span v-if="row.is_default" class="shrink-0 rounded-sm px-2 py-0.5 text-xs" :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }">常用</span>
                                <SampleBadge v-if="row.is_sample" />
                            </div>

                            <!-- 撐滿整列高度，觸控目標才滿足《03》§7 的 44px。
                   卡片本來就固定高度，所以這不會造成額外的視覺變化。 -->
                            <NuxtLink :to="`/equipment/${row.id}/edit`" class="flex shrink-0 items-center px-2 text-sm underline" :style="{ color: 'var(--accent)', alignSelf: 'stretch', minWidth: 'var(--touch-min)' }">編輯</NuxtLink>
                        </div>

                        <!-- 第二行：兩項都可能為空，空的時候不顯示文字但保留行高，
                 卡片高度才不會隨內容跳動。
                 備註不是次要資訊——兩台同型號的器材（例如兩台 C40）
                 名稱完全相同時，備註是唯一的辨識依據。
                 兩項之間用間距分隔，不用中間點（《03》§1 禁止 meta 串接）。 -->
                        <p class="flex items-baseline gap-4 text-sm text-muted" :style="{ minHeight: 'calc(var(--text-sm) * var(--text-sm--line-height))' }">
                            <span class="min-w-0 flex-1 truncate">{{ row.note }}</span>
                            <span class="shrink-0 tabular-nums">{{ relativeUsed(lastUsed.get(row.id)) }}</span>
                        </p>
                    </li>
                </ul>
            </section>
        </div>

        <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽），而且都導向新增頁——
             這裡原本是 href="#" 加頁內表單，外觀相同、行為不同 -->
        <NuxtLink to="/equipment/new" aria-label="新增器材" class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-full" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }">
            <svg
                width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"
                fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
            >
                <path d="M5 12h14" />
                <path d="M12 5v14" />
            </svg>
        </NuxtLink>
    </main>
</template>
