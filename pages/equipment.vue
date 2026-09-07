<script setup lang="ts">
    // 器材管理（《02-功能規格》§3：列表、新增、設定常用）。
    //
    // 規格的頁面清單只有 /equipment 一條路由，因此新增與編輯都在這一頁內完成，
    // 不另開 /equipment/new 與 /equipment/[id]。

    interface EquipmentRow {
        id: string;
        catalog_id: string | null;
        type: EquipmentType;
        custom_name: string | null;
        is_default: boolean;
        note: string | null;
        equipment_catalog: { brand: string; model: string; variant: string | null } | null;
    }

    const supabase = useSupabaseClient();
    const cache = useQueryCache();
    const userId = useCurrentUserId();

    const items = ref<EquipmentRow[]>([]);
    const loading = ref(true);
    const loadError = ref("");
    const actionError = ref("");

    // null = 沒在編輯；'new' = 新增；其餘為該筆 id
    const editing = ref<string | null>(null);
    const saving = ref(false);
    const formError = ref("");
    const confirmId = ref<string | null>(null);
    const deleting = ref(false);

    const form = reactive({
        type: "grinder" as EquipmentType,
        catalog_id: null as string | null,
        custom_name: "",
        note: "",
        is_default: false,
    });
    const selectedCatalog = ref<CatalogRow | null>(null);

    const scaleSpec = computed<GrindScaleSpec>(() => {
        const c = selectedCatalog.value;
        if (!c) return emptyGrindScale;
        return {
            min: c.grind_scale_min,
            max: c.grind_scale_max,
            increment: c.grind_scale_increment,
            suggestedMin: c.grind_scale_suggested_min,
            suggestedMax: c.grind_scale_suggested_max,
            note: c.grind_scale_note,
        };
    });

    function displayName(row: EquipmentRow) {
        if (row.equipment_catalog) {
            const c = row.equipment_catalog;
            return `${c.brand} ${c.model}${c.variant ? ` ${c.variant}` : ""}`;
        }
        return row.custom_name ?? "未命名器材";
    }

    const grouped = computed(() => equipmentTypes.map((type) => ({ type, rows: items.value.filter((item) => item.type === type) })).filter((group) => group.rows.length > 0));

    async function fetchEquipment() {
        // 排序寫死：常用器材在前，再依建立時間，最後用 id 當決勝鍵
        const { data, error } = await supabase.from("user_equipment").select("id, catalog_id, type, custom_name, is_default, note, equipment_catalog ( brand, model, variant )").order("is_default", { ascending: false }).order("created_at", { ascending: true }).order("id", { ascending: true });
        if (error) throw toError(error);
        return (data ?? []) as unknown as EquipmentRow[];
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

    function startCreate() {
        editing.value = "new";
        formError.value = "";
        selectedCatalog.value = null;
        pressedDefault.value = false;
        Object.assign(form, { type: "grinder", catalog_id: null, custom_name: "", note: "", is_default: false });
    }

    function startEdit(row: EquipmentRow) {
        editing.value = row.id;
        formError.value = "";
        selectedCatalog.value = null;
        pressedDefault.value = false;
        Object.assign(form, {
            type: row.type,
            catalog_id: row.catalog_id,
            custom_name: row.custom_name ?? "",
            note: row.note ?? "",
            is_default: row.is_default,
        });
    }

    /**
     * 這次編輯有沒有按過「設為常用」。
     *
     * 用來決定要不要顯示回饋，而不是拿 form.is_default 直接判斷——
     * 本來就是常用的那台一打開表單就是 true，那不是「剛剛做了什麼」，
     * 是「原本就是這樣」，不該冒出一句回饋。
     */
    const pressedDefault = ref(false);

    function toggleDefault() {
        form.is_default = !form.is_default;
        pressedDefault.value = true;
    }

    /**
     * 表單上這台的名稱，給回饋文案用。
     * 以表單當下的值為準（使用者可能剛改過名字），沒有名字時回 null。
     */
    const formName = computed(() => {
        if (form.catalog_id && selectedCatalog.value) return catalogDisplayName(selectedCatalog.value);
        const typed = form.custom_name.trim();
        if (typed) return typed;
        const row = items.value.find((item) => item.id === editing.value);
        return row ? displayName(row) : null;
    });

    function cancel() {
        editing.value = null;
        formError.value = "";
    }

    /**
     * 每個類型只能有一台常用（DB 有 partial unique index，欄位名仍是 is_default）。
     * 先把同類型的既有常用清掉再設新的，否則會撞上唯一約束，
     * 把資料庫層的錯誤訊息丟到使用者面前。
     */
    async function clearDefault(type: EquipmentType, exceptId?: string) {
        if (!userId.value) return;
        let request = supabase
            .from("user_equipment")
            .update({ is_default: false } as never)
            .eq("user_id", userId.value)
            .eq("type", type)
            .eq("is_default", true);
        if (exceptId) request = request.neq("id", exceptId);
        const { error } = await request;
        if (error) throw toError(error);
    }

    async function save() {
        if (!userId.value) {
            formError.value = SESSION_EXPIRED;
            return;
        }
        // 型錄與自訂名稱至少要有一個（DB 的 name_or_catalog check 也擋，
        // 但不該讓使用者看到資料庫的錯誤訊息）
        if (!form.catalog_id && !form.custom_name.trim()) {
            formError.value = "選一個型號，或直接填名稱";
            return;
        }

        saving.value = true;
        formError.value = "";
        try {
            if (form.is_default) await clearDefault(form.type, editing.value === "new" ? undefined : editing.value!);

            const row = {
                user_id: userId.value,
                type: form.type,
                catalog_id: form.catalog_id,
                custom_name: form.catalog_id ? null : form.custom_name.trim(),
                note: form.note.trim() || null,
                is_default: form.is_default,
            };

            const { error } =
                editing.value === "new"
                    ? await supabase.from("user_equipment").insert(row as never)
                    : await supabase
                          .from("user_equipment")
                          .update(row as never)
                          .eq("id", editing.value!);
            if (error) throw toError(error);

            editing.value = null;
            cache.invalidateAfter({ kind: "equipment" });
            await load();
        } catch (e) {
            formError.value = `儲存失敗：${errorText(e)}`;
        } finally {
            saving.value = false;
        }
    }

    async function destroy() {
        if (!confirmId.value) return;
        deleting.value = true;
        const { error } = await supabase.from("user_equipment").delete().eq("id", confirmId.value);
        deleting.value = false;
        confirmId.value = null;
        if (error) {
            actionError.value = `刪除失敗：${errorText(error)}`;
            return;
        }
        // 刪掉的就是正在編輯的那一筆，表單要跟著收起來
        editing.value = null;
        cache.invalidateAfter({ kind: "equipment" });
        await load();
    }

    const inputStyle = {
        minHeight: "var(--touch-min)",
    };
</script>

<template>
    <main class="mx-auto px-5 pt-10 pb-32" :style="{ maxWidth: 'var(--content-max)' }">
        <div class="flex items-baseline justify-between">
            <h1 class="font-serif text-xl font-bold">器材</h1>
            <NuxtLink to="/" class="text-sm underline" :style="{ color: 'var(--accent)' }">回首頁</NuxtLink>
        </div>

        <p v-if="loadError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
            {{ loadError }}
        </p>
        <p v-if="actionError" role="alert" class="mt-4 text-sm" :style="{ color: 'var(--danger)' }">
            {{ actionError }}
        </p>

        <!-- 新增／編輯表單。與豆子、沖煮表單同一套分組卡片。 -->
        <div v-if="editing" class="mt-6">
            <FormCard :title="editing === 'new' ? '新增器材' : '編輯器材'">
                <FormRow>
                    <label class="block text-sm" for="equipment-type">
                        類型
                        <span :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
                        <span class="sr-only">必填</span>
                    </label>
                    <SelectField>
                        <select id="equipment-type" v-model="form.type" class="mt-1 block w-full field py-2.5" :style="inputStyle">
                            <option v-for="type in equipmentTypes" :key="type" :value="type">
                                {{ equipmentLabels[type] }}
                            </option>
                        </select>
                    </SelectField>
                </FormRow>

                <FormRow>
                    <CatalogSelect v-model="form.catalog_id" :type="form.type" @selected="selectedCatalog = $event" />
                    <!-- 型錄存在的唯一目的是讓刻度這個數字可以被正確解讀（§3.2） -->
                    <div v-if="form.type === 'grinder' && selectedCatalog && (!isFreeformScale(scaleSpec) || scaleSpec.note)" class="mt-3 rounded-sm px-3 py-3 text-sm" :style="{ background: 'var(--accent-wash)', color: 'var(--on-accent-wash)' }">
                        <!-- 無刻度的機型不說「這台面板沒有刻度標示」：
                 不顯示範圍提示本身就已經表達了 -->
                        <template v-if="!isFreeformScale(scaleSpec)">
                            <p class="tabular-nums">
                                刻度範圍 {{ grindScaleRangeLabel(scaleSpec) }}
                                <span v-if="scaleSpec.increment !== null" class="ml-3">最小間隔 {{ scaleSpec.increment }}</span>
                                <span v-else class="ml-3">連續無段</span>
                            </p>
                            <p v-if="grindScaleSuggestionLabel(scaleSpec)" class="mt-1 tabular-nums">
                                {{ grindScaleSuggestionLabel(scaleSpec) }}
                            </p>
                        </template>
                        <p v-if="scaleSpec.note" class="mt-1">{{ scaleSpec.note }}</p>
                    </div>
                </FormRow>

                <FormRow>
                    <label class="block text-sm" for="equipment-name">
                        自訂名稱
                        <span v-if="!form.catalog_id" :style="{ color: 'var(--danger)' }" aria-hidden="true">*</span>
                        <span v-if="!form.catalog_id" class="sr-only">必填</span>
                    </label>
                    <input id="equipment-name" v-model="form.custom_name" type="text" :disabled="!!form.catalog_id" class="mt-1 block w-full field py-2.5 disabled:opacity-60" :style="inputStyle" />
                    <p class="mt-1 text-xs text-muted">
                        {{ form.catalog_id ? "已選型號，用型錄的名稱" : "型錄裡沒有的直接填名稱" }}
                    </p>
                </FormRow>

                <FormRow>
                    <label class="block text-sm" for="equipment-note">備註</label>
                    <input id="equipment-note" v-model="form.note" type="text" class="mt-1 block w-full field py-2.5" :style="inputStyle" />
                    <p class="mt-1 text-xs text-muted">例如換刀盤、加裝配件</p>
                </FormRow>

                <FormRow>
                    <!-- 動作按鈕而非 toggle。同類型只能有一台常用（DB 有 partial
               unique index），toggle 表達的是獨立的開關，用它承載單選會讓
               副作用隱形——使用者看不到「開啟這台會關掉另一台」。
               改成兩個狀態的按鈕，並把副作用寫在下面那行。 -->
                    <button
                        type="button"
                        class="w-full rounded-sm border px-4 py-3"
                        :style="{
                            borderColor: form.is_default ? 'var(--border-strong)' : 'var(--accent)',
                            color: form.is_default ? 'var(--text)' : 'var(--accent)',
                            minHeight: 'var(--touch-min)',
                        }"
                        @click="toggleDefault"
                    >
                        {{ form.is_default ? "取消常用" : "設為常用" }}
                    </button>

                    <!-- 事後回饋，不是事前警告。使用者按下「設為常用」時意圖已經很明確，
                         事前提醒他會換掉哪一台，是把系統的顧慮丟給他判斷——與模糊比對
                         從攔截器改成過濾器是同一個問題。 -->
                    <p v-if="form.is_default && pressedDefault" class="mt-2 text-xs text-muted">
                        {{ formName ? `已將 ${formName} 設為常用` : "已設為常用" }}
                    </p>

                    <!-- 沒有任何常用是合法狀態，新使用者本來就沒有。不阻止取消。 -->
                    <p v-else-if="!form.is_default" class="mt-2 text-xs text-muted">新增紀錄時會自動填入</p>
                </FormRow>
            </FormCard>

            <button type="button" :disabled="saving" class="mt-4 w-full rounded-sm px-4 py-3 font-medium disabled:opacity-60" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', minHeight: 'var(--touch-min)' }" @click="save">
                {{ saving ? "儲存中" : "儲存" }}
            </button>

            <p v-if="formError" role="alert" class="mt-3 rounded-sm border px-3 py-3 text-sm" :style="{ color: 'var(--danger)', borderColor: 'var(--danger)' }">
                {{ formError }}
            </p>

            <button type="button" class="mt-3 w-full rounded-sm border px-4 py-3" :style="{ borderColor: 'var(--border)', minHeight: 'var(--touch-min)' }" @click="cancel">取消</button>

            <!-- 刪除從卡片收進這裡：低頻且不可復原的動作不該排在列表上，
           與「編輯」並列時兩者的視覺權重也不對等。
           放在儲存與取消之後，不帶邊框，是這一頁權重最低的動作。 -->
            <button v-if="editing !== 'new'" type="button" class="mt-3 w-full rounded-sm px-4 py-3 text-sm" :style="{ color: 'var(--danger)', minHeight: 'var(--touch-min)' }" @click="confirmId = editing">刪除</button>
        </div>

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
                            </div>

                            <!-- 撐滿整列高度，觸控目標才滿足《03》§7 的 44px。
                   卡片本來就固定高度，所以這不會造成額外的視覺變化。 -->
                            <button type="button" class="flex shrink-0 items-center px-2 text-sm underline" :style="{ color: 'var(--accent)', alignSelf: 'stretch', minWidth: 'var(--touch-min)' }" @click="startEdit(row)">編輯</button>
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

        <NuxtLink to="#" aria-label="新增器材" class="fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-full" :style="{ background: 'var(--accent)', color: 'var(--on-accent)', boxShadow: 'var(--overlay-shadow)' }" @click.prevent="startCreate">
            <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
            </svg>
        </NuxtLink>

        <ConfirmDialog :open="confirmId !== null" title="刪除這個器材？" body="刪掉之後沒辦法復原。已經記錄過的沖煮不會消失，只是那筆紀錄上的器材欄位會變成空的。" confirm-label="刪除這個器材" :busy="deleting" @cancel="confirmId = null" @confirm="destroy" />

        <BottomNav />
    </main>
</template>
