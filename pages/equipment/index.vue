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
    // 「上次使用」這一份資料到了沒有。還沒到（或查詢失敗）時第二行不寫「還沒用過」：那是不知道，不是沒用過
    const usageKnown = ref(false);

    // 第二行的「上次使用」與整列的無障礙名稱（utils/equipment.ts）
    const usage = (row: UserEquipmentRow) => equipmentUsage(lastUsed.value.get(row.id), usageKnown.value);
    const rowLabel = (row: UserEquipmentRow) =>
        equipmentRowLabel({ name: equipmentOptionName(row), isDefault: row.is_default, isSample: row.is_sample, note: row.note, usage: usage(row) });

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
                usageKnown.value = true;
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
    <!-- 底部留白（分頁列與浮動按鈕）由 app.vue 讓出，這裡不留 -->
    <main class="mx-auto px-5 pt-10" :style="{ maxWidth: 'var(--content-max)' }">
        <!-- 瀏覽型：頂部只有標題。回總覽是分頁列的事，這裡不放第二個入口 -->
        <PageHeader title="器材" />

        <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
            {{ loadError }}
        </p>

        <!-- 骨架：和內容同一個版面——段落標題加一張卡片、卡片裡兩行的列（2026-11-27）。
             卡片是 ml（18px）：色塊離卡片邊 16／18，照《03》§2.3.1 是 18 − 16 ＝ 2px，等於色塊的預設圓角，不另外傳 -->
        <div v-if="loading" aria-busy="true" aria-label="讀取中" class="flex flex-col" :style="{ marginTop: 'var(--gap-section)', gap: 'var(--gap-section)' }">
            <section v-for="n in 2" :key="n" class="flex flex-col" :style="{ gap: 'var(--gap-group)' }">
                <SkeletonBlock width="4rem" height="1.25rem" class="card-pad-x-margin" />
                <AppCard radius="ml" border-inside class="overflow-hidden">
                    <ul>
                        <li v-for="row in 2" :key="row" class="equipment-skeleton-row card-pad-x flex flex-col" :style="{ paddingBlock: 'var(--sheet-pad-two-line)', gap: '2px' }">
                            <span class="flex items-center" :style="{ height: 'var(--sheet-line)' }"><SkeletonBlock width="55%" height="1.125rem" /></span>
                            <span class="flex items-center" :style="{ height: 'calc(var(--text-body-m) * var(--text-body-m--line-height))' }"><SkeletonBlock width="35%" height="0.875rem" /></span>
                        </li>
                    </ul>
                </AppCard>
            </section>
        </div>

        <p v-else-if="!items.length && !loadError" class="text-muted" :style="{ marginTop: 'var(--gap-section)' }">設為常用的器材，新增紀錄時會自動帶入。</p>

        <!-- 分組（2026-11-27，Figma 3670:1760）：每個類型是一個段落（FormSection：標題 Heading L、和卡片裡的列文字對齊），
             底下一張卡片，每台器材一列。卡片是分頁第一層的 ml（18px，2026-11-27 第二版；第一版誤用表單卡片的 24px），
             邊界與陰影和總覽、豆子列表、紀錄卡片相同；只有一台時也是 ml，不是膠囊形。
             外框畫在內側（border-inside），列文字和段落標題對齊在同一條線。
             段落之間 --gap-section、標題到卡片 --gap-group，和紀錄詳情、豆子詳情相同 -->
        <div v-else class="flex flex-col" :style="{ marginTop: 'var(--gap-section)', gap: 'var(--gap-section)' }">
            <FormSection v-for="group in grouped" :key="group.type" :title="equipmentLabels[group.type]">
                <AppCard radius="ml" border-inside class="overflow-hidden">
                    <ul>
                        <!-- 整列是通往編輯頁的連結，畫面上沒有「編輯」兩個字：無障礙名稱開頭是「編輯」，
                             名稱、常用、範例、備註、上次使用都在裡面（equipmentRowLabel） -->
                        <TwoLineRow v-for="row in group.rows" :key="row.id" :to="`/equipment/${row.id}/edit`" :aria-label="rowLabel(row)">
                            <!-- 標籤緊跟名稱：它是名稱的修飾語，屬於身分而非動作 -->
                            <template #title>
                                <span class="min-w-0 truncate">{{ equipmentOptionName(row) }}</span>
                                <span v-if="row.is_default" class="shrink-0 rounded-sm px-2 py-0.5 text-sm" :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }">常用</span>
                                <SampleBadge v-if="row.is_sample" />
                            </template>
                            <!-- 第二行：備註、上次使用。備註不是次要資訊——兩台同型號的器材（例如兩台 C40）
                                 名稱完全相同時，備註是唯一的辨識依據。兩項都沒有時整行不出現 -->
                            <template v-if="row.note?.trim() || usage(row)" #meta>
                                <span v-if="row.note?.trim()" class="min-w-0 truncate">{{ row.note }}</span>
                                <span v-if="usage(row)" class="shrink-0 tabular-nums">{{ usage(row) }}</span>
                            </template>
                        </TwoLineRow>
                    </ul>
                </AppCard>
            </FormSection>
        </div>

        <!-- 列表頁的新增入口一律是右下角浮動按鈕（§3 導覽），而且都導向新增頁——
             這裡原本是 href="#" 加頁內表單，外觀相同、行為不同。陰影是懸浮按鈕的 --float-shadow（2026-11-27） -->
        <NuxtLink to="/equipment/new" aria-label="新增器材" class="fab-position flex size-14 items-center justify-center rounded-full" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--float-shadow)' }">
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

<style scoped>
/* 骨架的段落標題：和 FormSection 的標題同一條線（--card-pad） */
.card-pad-x-margin {
    margin-inline: var(--card-pad);
}
/* 骨架的列之間一條分隔線，和 TwoLineRow 相同 */
.equipment-skeleton-row:not(:last-child) {
    box-shadow: inset 0 -1px 0 var(--border);
}
</style>
