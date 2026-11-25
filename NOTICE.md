# 第三方素材的來源與授權

## 圖示：Lucide

專案的介面圖示取自 **Lucide**（<https://lucide.dev>），授權為 **ISC License**。

**沒有安裝套件。** 需要的圖示逐一把 SVG 路徑抄進元件（`components/` 與 `pages/`），
尺寸、線寬與顏色改成《03-介面規範》§3 的規格——Lucide 原生是 24 格線、線寬 2，
本專案的圖示顯示在 16／18／22／24 四種尺寸，線寬只有 2px 與 1.5px 兩級，
所以 `stroke-width` 逐一重算。形狀本身未經修改。

目前使用的圖示（Lucide 名稱）：

| Lucide 名稱 | 專案裡的用途 |
|---|---|
| `chevron-left` | 返回、離開 |
| `chevron-right` | 選擇列右側的箭頭 |
| `chevron-down` | 下拉與收合區的箭頭 |
| `settings` | 首頁右上角的設定 |
| `x` | 移除列表中的單項 |
| `plus` | 新增 |
| `heart` | 收藏 |
| `star` | 星等 |
| `check` | 暫存狀態的「已暫存」、分享對話框的勾選框 |
| `share` | 分享 |

不是取自 Lucide 的圖示：器材類型（磨豆機、濾杯、濾紙、手沖壺、分享壺）、
攪拌標記、暫存狀態的 sync。前兩者在任何通用圖示庫裡都沒有對應物；
sync 有（`refresh-cw`）但形狀差得多，見 CLAUDE.md 的「V1 視覺待處理（凍結）」。

### ISC License

```
Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of
Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
```

## 圖示：底部分頁列（2026-11-25）

分頁列的四個圖示（`components/TabIcon.vue`）從 Figma 匯出，不是 Lucide。形狀未經修改，
只把顏色改成 `currentColor`、把豆子與器材平移到 24 格線裡 Figma 的位置。

| 分頁 | 圖示 | 來源 | 授權 |
|---|---|---|---|
| 總覽 | `home` | **Google Material Symbols**（<https://fonts.google.com/icons>） | Apache License 2.0 |
| 紀錄 | brew | **Google Material Symbols** | Apache License 2.0 |
| 豆子 | bean | **Iconify**（<https://icon-sets.iconify.design>），**圖示集名稱待確認** | **待確認**（依圖示集而定） |
| 器材 | equip | 專案自繪 | — |

豆子的圖示集確認之後，把上表的「待確認」換成圖示集名稱與它的授權（Iconify 本身只是集合，
每個圖示集的授權不同）。

### Apache License 2.0（Material Symbols）

```
Copyright Google LLC

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## 字體：台北黑體（Taipei Sans TC Beta）

內文字體是 **台北黑體**（翰字鑄造 JT Foundry，字型檔記載的網址是 bit.ly/jtfoundry），
授權為 **SIL Open Font License 1.1**。字型檔內的著作權宣告是
「Taipei Sans TC is a modified font of Source Han Sans.」

**自己放，不靠外部服務。** `public/fonts/taipei-sans/v1/` 的 woff2 是由原始 TTF
切出的子集（`scripts/slice-fonts.py`）：只取部分字、轉成 woff2，字形未經修改；
每個檔案都保留了字型檔內的著作權與授權宣告。授權全文在 `public/fonts/taipei-sans/OFL.txt`，
跟著字型檔一起部署。原始 TTF 不在版本庫裡（`fonts-src/`，已列入 `.gitignore`）。

Medium（字重 500）與標題用的 **Noto Sans TC** 從 Google Fonts 載入，沒有放在專案裡；
它同樣是 SIL Open Font License 1.1。
