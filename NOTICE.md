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
| `settings` | 首頁右上角的設定 |
| `x` | 移除列表中的單項 |
| `plus` | 新增 |
| `heart` | 收藏 |
| `share` | 分享 |

不是取自 Lucide 的圖示：器材類型（磨豆機、濾杯、濾紙、手沖壺、分享壺）、
攪拌標記、星等、下拉的 ⌄、暫存狀態的打勾與 sync——這些仍是專案自繪，
見 CLAUDE.md 的「V1 視覺待處理（凍結）」。

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
