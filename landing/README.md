# 渠道落地页（纯静态）

无需 Node 服务器、无需 API。双击 HTML 或用任意静态托管即可访问。

## 文件

| 文件 | 说明 |
|------|------|
| `index.html` | 渠道汇总入口 |
| `xiaoetong.html` | 小鹅通落地页 |
| `tencentmeeting.html` | 腾讯会议落地页 |
| `feishu.html` | 飞书落地页 |
| `quanneng.html` | 全能落地页 |
| `landing-data.js` | 文案与链接（改 `guideUrl` 等在此） |
| `landing.css` / `landing.js` | 样式与渲染 |
| `icons/` | 渠道图标 |

## 本地预览

```bash
open landing/index.html
# 或
cd landing && python3 -m http.server 8080
# 浏览器打开 http://127.0.0.1:8080/
```

## 发给客户的链接

将整个 `landing/` 文件夹上传到对象存储 / GitHub Pages / 任意静态网站，例如：

- `https://你的域名/landing/index.html`
- `https://你的域名/landing/xiaoetong.html`

「使用说明」按钮指向 `landing-data.js` 里的 `guideUrl`（默认 `https://api.shentongxue.online/guide/`）。

**微信二维码**：将你的个人微信二维码保存为 `landing/wechat-qr.png`（或改 `purchase.wechatQr` 路径），替换当前的 `wechat-qr.svg` 占位图。价格与备注在 `landing-data.js` 的 `purchase` 里修改。
