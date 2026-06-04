# 渠道配置（GPL 源码）

每个子目录代表一个**渠道构建**，配置为公开源码的一部分。

## 目录结构

```
channels/<channel-id>/
  channel.json    # 白名单、manifest、locales、lockOptions、repositoryUrl
  README.md       # 域名说明、试点链接
channels/_template/
  channel.json    # 新渠道复制模板
```

### channel.json 常用字段

| 字段 | 说明 |
|------|------|
| `optionLists.blockUrl` + `blockUrlWhite: true` | 域名白名单 |
| `lockOptions` | 设置页锁定项（如 `blockUrl`, `deepSearch`） |
| `installPage` | 首次安装页，渠道一般为 `channel-install.html` |
| `locales` | 覆盖 `_locales` 中 `catCatch`、`description`（工具栏/i18n） |
| `repositoryUrl` | GPL 源码仓库，写入 `channel-build.json` 与关于页 |

## 构建

```bash
npm run build -- <channel-id>
```

## 新增渠道

1. 复制 `xiaoetong/` 为模板。  
2. 编辑 `channel.json` 中的 `optionLists.blockUrl` 与 `blockUrlWhite: true`。  
3. 编写 `README.md` 说明适用站点与法律依据（用户自有/已授权内容）。  
4. 构建并在目标站点回归测试。  
5. 打 Git tag：`channel-id-vX.Y.Z`。  

## 白名单语义

与 Cat-Catch 设置「屏蔽网址 + 白名单模式」一致：仅当标签页 URL 匹配 `blockUrl` 列表时启用嗅探。
