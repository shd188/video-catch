# 上游跟踪

| 字段 | 值 |
|------|-----|
| 项目 | [Cat-Catch / 猫抓](https://github.com/xifangczy/cat-catch) |
| 上游许可证 | GPL-3.0（2.0 起） |
| 本树基准版本 | 2.6.9（见 `manifest.json`） |
| 远程 | `git@github.com:xifangczy/cat-catch.git` |

## 合并上游更新

1. 添加上游 remote（若尚未添加）：  
   `git remote add upstream https://github.com/xifangczy/cat-catch.git`
2. 获取上游标签与分支，合并或 rebase 到本仓库主分支。  
3. 解决冲突后回归测试：嗅探、小鹅通白名单构建、`npm run build -- xiaoetong`。  
4. 更新本文件中的「本树基准版本」与 `NOTICE`。  
5. 为受影响的渠道包打新 tag。

## 本仓库相对上游的增量

- `channels/` — 各渠道 GPL 配置、图标、文案  
- `scripts/build-channel.mjs` — 渠道构建（扩展名、图标覆盖等）  
- `js/channel-init.js` — 渠道默认项注入（构建时覆盖）  
- `css/channel-theme.css`、`css/install.css`、`css/popup-channel.css`、`css/channel-options.css`、`channel-install.html` — **渠道 UI 定制**  
- `js/popup-channel.js`、`js/options-channel.js`、`js/license-ui.js` 等 — 渠道 UI 行为  
- `server/public/admin/` — 管理后台 UI（专有）  
- `docs/COMPLIANCE.md`、`docs/SERVICE.md`、`NOTICE` — 合规与服务说明  
- **`docs/UI-CUSTOMIZATION.md`** — UI 改动清单与合并时「保留现版 UI」策略（**合并前建议阅读**）

### 合并冲突优先级

| 优先级 | 路径 | 策略 |
|--------|------|------|
| 1 | `channels/`、`css/channel-*.css`、`channel-install.html`、`server/` | **保留本仓库** |
| 2 | `popup.html`、`js/init.js`、渠道相关 `js/*-channel.js`、`js/license-*.js` | **合并两边**（上游结构 + 本仓库脚本） |
| 3 | `css/popup.css`、`css/public.css`、嗅探核心 `js/`、`catch-script/` | **以上游为准**，再跑 `npm run build -- xiaoetong` 做 UI 回归 |

上游合并时优先保留 `channels/`、`docs/UI-CUSTOMIZATION.md` 所列 UI 文件与 `docs/`；对嗅探核心以解决冲突后**功能**为准，对渠道 UI 以**现版视觉与文案**为准。
