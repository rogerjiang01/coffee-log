<script setup lang="ts">
// 比較表（《03-介面規範》§4.6）。
//
// 本產品最重要的單一元件，也是對 Excel 使用者的核心差異化。
//
// 第一欄（日期）固定不動，其餘橫向捲動。sticky 的那一格必須有不透明底色，
// 否則捲動時後面的內容會從它底下透出來——而且底色要跟著該列走，
// 收藏列與一般列不同。
//
// 收藏的標示不只靠底色：§2 說明過淺色底在暖底色上幾乎看不出來，
// 所以最右欄另有愛心圖示。

const props = defineProps<{
  rows: CompareRow[]
}>()

const columns = compareColumns

function rowBackground(row: CompareRow) {
  return row.isFavorite ? 'var(--accent-wash)' : 'var(--surface)'
}
</script>

<template>
  <div
    class="overflow-hidden rounded-md border"
    :style="{ borderColor: 'var(--border)', background: 'var(--surface)' }"
  >
    <div class="overflow-x-auto">
      <table class="w-full border-collapse text-sm tabular-nums">
        <thead>
          <tr :style="{ background: 'var(--surface)' }">
            <th
              scope="col"
              class="sticky left-0 z-10 whitespace-nowrap border-r px-3 py-2 text-left font-normal"
              :style="{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-muted)' }"
            >
              日期
            </th>
            <th
              v-for="column in columns"
              :key="column"
              scope="col"
              class="whitespace-nowrap px-3 py-2 text-right font-normal"
              :style="{ color: 'var(--text-muted)' }"
            >
              {{ column }}
            </th>
            <th scope="col" class="px-3 py-2 text-right font-normal">
              <span class="sr-only">收藏</span>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            class="border-t"
            :style="{ borderColor: 'var(--border)', background: rowBackground(row) }"
          >
            <!-- 日期固定不動。底色跟著該列，否則捲動時內容會透出來。 -->
            <!-- 右邊界讓捲動時固定欄與內容之間看得出分界，
                 否則兩欄的數字會貼在一起分不清。 -->
            <th
              scope="row"
              class="sticky left-0 z-10 whitespace-nowrap border-r px-3 py-3 text-left font-normal"
              :style="{ background: rowBackground(row), borderColor: 'var(--border)' }"
            >
              <NuxtLink :to="`/brews/${row.id}`" class="block" :style="{ color: 'var(--text)' }">
                {{ row.date }}
              </NuxtLink>
            </th>

            <td
              v-for="(cell, index) in row.cells"
              :key="index"
              class="whitespace-nowrap px-3 py-3 text-right"
            >
              <!-- 與前一列不同的數值加字重與顏色。
                   §2：色彩不得作為唯一的資訊載體，所以字重也一起變。 -->
              <NuxtLink
                :to="`/brews/${row.id}`"
                class="block"
                :style="cell.changed
                  ? { color: 'var(--diff)', fontWeight: 500 }
                  : { color: 'var(--text)' }"
              >
                {{ cell.value }}
              </NuxtLink>
            </td>

            <td class="px-3 py-3 text-right">
              <NuxtLink :to="`/brews/${row.id}`" class="block">
                <svg
                  v-if="row.isFavorite"
                  width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" class="inline-block"
                >
                  <path
                    d="M12 20s-7-4.5-7-9.5A3.5 3.5 0 0112 8a3.5 3.5 0 017 2.5C19 15.5 12 20 12 20z"
                    fill="var(--favorite)" stroke="var(--favorite)" stroke-width="1.5" stroke-linejoin="round"
                  />
                </svg>
                <span v-if="row.isFavorite" class="sr-only">已收藏</span>
              </NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
