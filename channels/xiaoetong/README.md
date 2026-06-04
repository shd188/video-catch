# 小鹅通（Xiaoe）渠道试点

## 用途

在**小鹅通**生态页面内嗅探课程相关媒体（直播 H5、点播等），其它站点默认不工作（白名单模式）。

## 参考课程（试点）

- 直播课示例：  
  [小鹅通 H5 直播课](https://appkrjfyd6q7315.h5.xiaoeknow.com/v4/course/alive/l_5b0083070ce02_VbYUCnbU?app_id=appkrjfyD6q7315&l_program=xe_know_pc)  
- 店铺 H5 主机：`appkrjfyd6q7315.h5.xiaoeknow.com`  
- 路径特征：`/v4/course/alive/`（直播）、其它 `/v4/course/` 等由 `*.xiaoeknow.com` 覆盖  

## 白名单规则（`channel.json`）

| 模式 | 作用 |
|------|------|
| `https://appkrjfyd6q7315.h5.xiaoeknow.com/*` | 试点店铺精确匹配 |
| `https://*.h5.xiaoeknow.com/*` | 各商家 H5 子域 |
| `https://*.xiaoeknow.com/*` | 主站、静态资源、接口子域 |

`blockUrlWhite: true`：未命中上述模式的标签页**不嗅探**。

## 构建与安装

```bash
npm run build -- xiaoetong
```

Chrome / Edge：扩展管理 → 开发者模式 → 加载已解压 → 选择 `dist/xiaoetong/`。

首次安装会打开 **GPL / 服务说明** 页（`channel-install.html`）。设置页中「屏蔽网址」已隐藏，改为 **渠道白名单（只读）**；`深度搜索` 在本渠道构建中锁定为关闭。

**Popup** 顶部显示渠道名与当前页是否在白名单内。**导入配置** 不会覆盖白名单等锁定项；**导出** 省略锁定项。Firefox 与 Chrome 共用 `init.js` 的安装页逻辑（已移除 `firefox.js` 重复弹窗）。

**下载 / m3u8 合并**：本渠道默认 **关闭在线 FFmpeg**（不会弹出 [ffmpeg.bmmmd.com](https://ffmpeg.bmmmd.com/)），改用解析器内 **「转为 mp4」** 在浏览器本地合并。若你曾开启过在线 FFmpeg，请重新构建并加载扩展，或在设置 → m3u8 解析器 中取消勾选「在线 FFmpeg」。

发布前请在 `channel.json` 将 `repositoryUrl` 改为你公开的 GPL 仓库地址。

## 维护提示

- 小鹅通改版若新增独立域名，在 `channel.json` 的 `blockUrl` 中追加条目后重新构建并打 tag。  
- 仅服务**用户有权访问**的课程内容；遵守平台服务条款与著作权法。  
- 若需支持其它店铺，可只加一条 `https://<shop>.h5.xiaoeknow.com/*` 而不扩大全国通配（按合规策略选择）。  

## 合规

本渠道配置为 GPL 源码的一部分；商业收费说明见 [docs/SERVICE.md](../../docs/SERVICE.md)。
