# UI 定制说明与上游合并保留策略

本文档记录本仓库相对 [Cat-Catch](https://github.com/xifangczy/cat-catch) 的 **UI / 文案 / 品牌** 改动，便于合并上游时**刻意保留**现版体验，而不是被上游样式覆盖。

设计取向：国际大厂常见的简洁风（系统字体、克制配色、统一圆角与间距），见 `css/channel-theme.css` 中的设计变量。

---

## 1. 改动清单（截至 2026-06）

### 1.1 设计系统（渠道构建共用）

| 文件 | 说明 |
|------|------|
| `css/channel-theme.css` | **新增**。字体栈、字号阶梯、间距、圆角、主色 `#0071e3`、浅灰背景、深色模式变量 |

### 1.2 扩展 — 渠道用户界面

| 文件 | 说明 |
|------|------|
| `css/install.css` | **重写**。安装说明页；去掉渐变/浮动动画/大量 emoji，改用 `channel-theme` |
| `channel-install.html` | **重写结构**。分区标题纯文字；按钮「我已阅读」「打开设置」 |
| `css/popup-channel.css` | **扩展**。主弹窗顶部渠道状态条样式 + 弹窗 `body` 字体 |
| `css/channel-options.css` | **扩展**。设置页渠道横幅、白名单只读区 |
| `js/popup-channel.js` | 渠道条文案（去掉 ✓✗ emoji）；加载 `popup-channel.css` |
| `js/license-ui.js` | 激活区使用 `ch-input` / `ch-hint` 等 class，与安装页一致 |
| `js/options-channel.js` | 加载 `channel-options.css`（逻辑未改，样式依赖上文） |

### 1.3 扩展 — 小鹅通渠道配置（构建时写入 dist）

| 位置 | 说明 |
|------|------|
| `channels/xiaoetong/channel.json` | `channelNameZh` → 扩展名 **小鹅通视频下载**；简介/描述文案；`locales.zh_CN.noData` → **还没找到视频哦~** |
| `channels/xiaoetong/icons/` | 渠道专属 `icon.png` / `icon128.png` / `icon-disable.png` |
| `scripts/build-channel.mjs` | 构建时复制 `channels/<id>/icons/`；`channelNameZh` 生成扩展名 |

### 1.4 管理后台（专有，不在上游）

| 文件 | 说明 |
|------|------|
| `server/public/admin/index.html` | 内联样式改为白底顶栏、分段 Tab、统一表单/表格圆角与焦点态 |

### 1.5 未改动的上游 UI（仅通过渠道 CSS **叠加**）

以下文件仍随上游更新，**不要**在合并时整文件替换成「只保留上游」而丢掉渠道叠加逻辑：

| 文件 | 本仓库策略 |
|------|------------|
| `css/public.css` / `css/popup.css` / `css/options.css` | 保持上游为主；渠道外观靠 `popup-channel.css` / `channel-options.css` |
| `popup.html` | 上游结构 + 本仓库追加的 `channel-init.js` / `popup-channel.js` 等脚本 |
| `_locales/zh_CN/messages.json` | 根目录仍为猫抓原文案；**渠道包**以 `channel.json` → `locales` 覆盖（如 `noData`） |

---

## 2. 文件归属（合并冲突时怎么选）

### 2.1 始终保留本仓库版本（「我们的」）

合并冲突时 **选 ours / 保留本分支**：

```
css/channel-theme.css
css/install.css
css/popup-channel.css
css/channel-options.css
channel-install.html
channels/
scripts/build-channel.mjs
js/channel-init.js
js/channel-config.js
js/channel-install.js
js/channel-options.js
js/popup-channel.js
js/license-client.js
js/license-ui.js
server/
docs/UI-CUSTOMIZATION.md
```

### 2.2 合并后需人工核对（「共享」）

上游常改，合并后打开页面看一眼，必要时把上游功能改动合进来，**但不要删掉**本仓库追加的脚本引用或渠道逻辑：

| 文件 | 保留要点 |
|------|----------|
| `popup.html` | 保留 `<script src="js/channel-init.js">`、`popup-channel.js`、`license-client.js` 等 |
| `options.html` | 保留 `options-channel.js` |
| `js/init.js` / `js/firefox.js` | 保留跳转 `channel-install.html` 的逻辑 |
| `manifest.json` | 保留 `channel-build.json`、侧载页等本仓库增量；渠道构建会再 patch |

### 2.3 优先采用上游（「他们的」）

无本仓库定制时，冲突 **选 theirs**，再跑渠道构建验证：

```
css/public.css
css/popup.css
css/options.css
catch-script/
（大部分 js/ 嗅探核心）
```

若上游改了弹窗 DOM 结构，只需调整 `js/popup-channel.js` 的插入位置（当前：`.Tabs` 之后），**不必**回退 `popup-channel.css` 的设计变量。

---

## 3. 合并上游的标准流程

```bash
# 1. 确保 upstream 指向 cat-catch（见 docs/UPSTREAM.md）
git fetch upstream

# 2. 合并（或 rebase，团队习惯二选一）
git merge upstream/master
# 若有冲突，按第 2 节「文件归属」处理

# 3. 构建与 UI 回归（必做）
npm install
npm run build -- xiaoetong

# 4. 肉眼检查
#    - 弹窗：渠道条样式、空列表「还没找到视频哦~」
#    - 安装页 channel-install.html（重新安装或手动打开）
#    - 设置页：渠道横幅与白名单只读
#    - 图标：工具栏为小鹅通蓝底图标
#    - 后台：/admin/ 布局与 Tab

# 5. 更新 docs/UPSTREAM.md 的「本树基准版本」
```

### 3.1 冲突速查

| 冲突文件 | 操作 |
|----------|------|
| `css/install.css` | **保留本仓库**（上游 `install.html` 用另一套样式，与 `channel-install.html` 无关） |
| `channel-install.html` | **保留本仓库**（上游可能没有此文件） |
| `popup.html` | **合并两边**：上游 HTML 改动 + 本仓库 channel/license 脚本标签 |
| `_locales/zh_CN/messages.json` | 一般 **采用上游**；小鹅通文案在 `channels/xiaoetong/channel.json` 的 `locales` 里，构建会覆盖 dist |

---

## 4. 新增 UI 定制时的约定

1. **渠道用户可见**：样式放 `css/channel-*.css` 或 `channels/<id>/`，避免直接大改 `popup.css` / `public.css`，减少与上游冲突面。  
2. **文案**：优先写在 `channels/<id>/channel.json` → `locales`，不要改根 `_locales`（除非全仓库统一）。  
3. **安装/激活**：改 `channel-install.html`、`css/install.css`、`js/license-ui.js`。  
4. **后台**：只改 `server/public/admin/`。  
5. **每次 UI 迭代**：在本文件 **§1 改动清单** 追加一行，并注明日期与渠道 ID。

---

## 5. 相关文档

- [docs/UPSTREAM.md](./UPSTREAM.md) — 上游版本与合并总流程  
- [docs/BUILD.md](./BUILD.md) — 渠道构建与 `locales` 覆盖  
- [channels/README.md](../channels/README.md) — `channelNameZh`、图标目录说明  
