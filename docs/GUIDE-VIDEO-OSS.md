# Guide 演示视频 · 阿里云 OSS + CDN

目标：把压缩后的教程片放到**国内 OSS + CDN**，Guide 页用 `cdnUrl` 直链播放，避免香港 API 机直出大文件。

## 一、准备压缩片（强烈建议）

原片约 35MB，请先压到约 **5–12MB**：

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"
brew install ffmpeg   # 若尚未安装
./scripts/compress-guide-video.sh
```

产物：`server/public/guide/xet-video-catch-web.mp4`（也可只作本地上传源，不必部署到香港机）。

## 二、创建 OSS Bucket

1. 打开 [阿里云 OSS 控制台](https://oss.console.aliyun.com/)
2. **创建 Bucket**：
   - 地域：选**中国大陆**（如华东1 杭州）— 面向国内用户
   - 读写权限：建议 **私有**，后面用 CDN 回源；若图省事可先 **公共读**（仅教程片、无敏感内容时）
   - 存储类型：标准
3. 进入 Bucket → **文件管理** → 上传：
   - 路径建议：`guide/xet-video-catch-web.mp4`
4. 若 Bucket 为公共读：选中文件 → **详情 / 复制文件 URL**，得到类似：
   ```
   https://your-bucket.oss-cn-hangzhou.aliyuncs.com/guide/xet-video-catch-web.mp4
   ```
   此链接可临时填进 `cdnUrl` 测试；正式环境请走下面 CDN。

## 三、绑定 CDN（推荐，播放才快）

1. 打开 [CDN 控制台](https://cdn.console.aliyun.com/) → **添加域名**
2. 加速域名：例如 `cdn.shentongxue.online`（需已解析到阿里云、大陆域名通常需备案）
3. 源站：选 **OSS 域名**，指向上一步 Bucket
4. 开启 **HTTPS**（申请免费证书或上传已有证书）
5. 缓存：对 `*.mp4` 缓存较久（如 7 天～30 天）
6. 等待配置生效后，访问：
   ```
   https://cdn.shentongxue.online/guide/xet-video-catch-web.mp4
   ```
   浏览器应能直接播放。

### 若暂时没有备案域名

- 可先用 **OSS 默认外网域名（公共读）** 测通 Guide
- 或用阿里云提供的 **测试加速域名**（若账号仍开放）
- 正式对客仍建议：备案域名 + CDN HTTPS

## 四、写入 Guide 配置

编辑仓库：

`server/public/guide/video-config.js`

```js
window.GUIDE_VIDEO_CONFIG = {
  title: "小鹅通扩展：嗅探与下载操作演示",
  cdnUrl: "https://cdn.你的域名.com/guide/xet-video-catch-web.mp4",
  bilibiliBvid: "",
};
```

部署 API 仓库后刷新：https://api.shentongxue.online/guide/#video

## 五、CORS（跨域）

Guide 页在 `api.shentongxue.online`，视频在 CDN/OSS 另一域名时：

- 多数浏览器播 `<video src="https://cdn...">` **不强制 CORS**
- 若以后用 `fetch` / MSE，再在 OSS/CDN 加 CORS 允许 `https://api.shentongxue.online`

## 六、费用参考

教程片约 10MB、访问量不大时：OSS 存储 + CDN 流量通常 **每月几毛到几元**。注意 CDN 流量包与 HTTPS 请求数计费项。

## 七、检查清单

- [ ] 已压缩为 web 版（远小于 35MB）
- [ ] 已上传 OSS，对象路径含 `guide/`
- [ ] CDN HTTPS 可直开 mp4
- [ ] `video-config.js` 的 `cdnUrl` 已填写
- [ ] `/guide/#video` 可点播放且开播较快
- [ ] 香港机 **不必**再托管大 mp4（可删 `server/public/guide/xet-video-catch.mp4` 减仓库体积）
