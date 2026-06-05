# 腾讯会议渠道

渠道 ID：`tencentmeeting`  
扩展名：**腾讯会议视频下载**  
简介：腾讯会议回放视频下载，仅限自有或已获授权的内容。

## 白名单

仅启用以下域名（`blockUrlWhite: true`）：

| 规则 | 说明 |
|------|------|
| `https://meeting.tencent.com/*` | 腾讯会议 Web 主域 |
| `https://*.meeting.tencent.com/*` | 腾讯会议子域 |

## 参考链接

回放页示例（落在 `meeting.tencent.com` 白名单内）：

https://meeting.tencent.com/crm/2BWn64Op68

## 构建

```bash
npm run build -- tencentmeeting
```

在浏览器加载 `dist/tencentmeeting/`。

## 图标

`icons/` 目录含渠道专用图标，构建时覆盖 `dist/tencentmeeting/img/`。
