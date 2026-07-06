# 飞书渠道

渠道 ID：`feishu`  
扩展名：**飞书视频下载**  
简介：飞书视频下载，仅限自有或已获授权的内容。

## 白名单

仅启用以下域名（`blockUrlWhite: true`，共 35 条 `https://*.域名/*` 规则）：

| 类别 | 域名 |
|------|------|
| 飞书主域 | `feishu.net`、`feishu.cn`、`larkoffice.com`、`larkenterprise.com` |
| 飞书资源 | `feishucdn.com`、`feishuimg.com`、`feishuapp.cn`、`getfeishu.cn`、`feishupkg.com`、`feishu-3rd-party-services.com` |
| 字节 CDN / 静态 | `byteimg.com`、`bytedance.net`、`bytedance.com`、`byted-static.com`、`bytegoofy.com`、`bytehwm.com`、`bytegecko.com`、`bytescm.com`、`bytetos.com`、`ttwebview.com` |
| 字节 API / 监控 | `zijieapi.com`、`byteeffecttos.com`、`bytednsdoc.com`、`bytedanceapi.com`、`bytedapm.com`、`ibytedapm.com`、`baseopendev.com` |
| 视频 / SDK | `volcvideo.com`、`pstatp.com`、`snssdk.com` |
| 其它配套 | `zjurl.cn`、`kundou.cn`、`feelgood.cn`、`aiforce.cloud`、`aiforce.run` |

完整规则见 `channel.json` → `optionLists.blockUrl`。

## 构建

```bash
npm run build -- feishu
```

在浏览器加载 `dist/feishu/`。

## 图标

`icons/` 目录含渠道专用图标，构建时覆盖 `dist/feishu/img/`。当前为占位图，可替换为飞书品牌图标。
