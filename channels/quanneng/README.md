# 全能渠道

默认通用渠道：**不使用站点白名单**，行为与上游 Cat-Catch 默认一致——在普通 `http(s)` 网页上均可嗅探媒体。

## 与其它渠道的区别

| | 全能 | 小鹅通 / 腾讯会议 / 飞书 |
|--|------|--------------------------|
| 模式 | `blockUrlWhite: false`，`blockUrl` 为空（黑名单空 = 全站可用） | `blockUrlWhite: true` + 域名白名单 |
| 适用站点 | 几乎所有普通网页 | 仅各自白名单域名 |
| 仍不可用 | `chrome://`、`chrome-extension://`、`about:` 等特殊页（上游 `isSpecialPage`） | 白名单外所有站点 |

## 配置要点

```json
"optionLists": {
  "blockUrlWhite": false,
  "blockUrl": []
}
```

锁定 `blockUrl` / `blockUrlWhite`，防止用户在设置里改成白名单或自行加黑名单而改变渠道语义。

## 构建

```bash
npm run build -- quanneng
npm run pack -- quanneng
```

产物：`dist/quanneng/`、`releases/quanneng-<version>.zip`。

## 合规

请仅下载自有或已获授权的内容，遵守目标站点服务条款与著作权法。
