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

- `channels/` — 各渠道 GPL 配置  
- `scripts/build-channel.mjs` — 渠道构建  
- `js/channel-init.js` — 渠道默认项注入（构建时覆盖）  
- `docs/COMPLIANCE.md`、`docs/SERVICE.md`、`NOTICE` — 合规与服务说明  

上游合并时优先保留 `channels/` 与 `docs/`，对 `js/`、`catch-script/` 以解决冲突后功能为准。
