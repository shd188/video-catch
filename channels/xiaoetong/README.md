# 小鹅通（Xiaoe）渠道试点

## 用途

在**小鹅通**生态页面内嗅探课程相关媒体（直播 H5、点播、PC 课程页等），其它站点默认不工作（白名单模式）。

## 链接规则（官方与常见 CDN）

小鹅通课程链接由 **`{店铺 appId}` + `{域名体系}` + `{资源路径}`** 组成。`appId` 为店铺唯一标识（通常小写，如 `apphjf3i1rv4248`）。

### H5 店铺（手机 / 微信 / PC 浏览器）

| 域名模式 | 示例 |
|----------|------|
| `https://{appId}.h5.xiaoeknow.com/...` | [直播课](https://apphjf3i1rv4248.h5.xiaoeknow.com/v4/course/alive/l_608ba9dee4b09890f0e8742c?app_id=apphJf3i1rV4248&l_program=xe_know_pc) |
| `https://{appId}.h5.xiaoe-tech.com/...` | 部分店铺使用 xiaoe-tech 域名，路径规则相同 |
| `https://{appId}.h5.xiaoecloud.com/...` | 部分店铺使用 xiaoecloud 域名，路径规则相同 |

常见路径（`{resourceId}` 为资源 ID，如 `l_608ba9…`、`v_624ff…`、`p_608ba…`）：

| 类型 | 路径模式 |
|------|----------|
| 直播（新版） | `/v4/course/alive/{resourceId}` |
| 直播（旧版） | `/v2/course/alive/{resourceId}` |
| 视频课 | `/p/course/video/{resourceId}` |
| 图文 / 音频 / 专栏等 | `/p/course/{type}/{resourceId}` |

参考：[小鹅通 WebSDK 课程链接说明](https://api-doc.xiaoe-tech.com/common_problem/problem.html)

### PC 店铺（电脑浏览器）

| 域名模式 | 示例 |
|----------|------|
| `https://{appId}.xet-pc.citv.cn/...` | [PC 视频课](https://app6ca5octe2206.xet-pc.citv.cn/p/t_pc/course_pc_detail/video/v_624ffcffe4b04e8d902d36e8?has_try=1) |
| `https://{appId}.pc.xiaoe-tech.com/...` | 官方 PC 域，路径与 CITV 线路一致 |
| `https://{appId}.xet.citv.cn/...` | CITV H5/课程页，如 `/p/course/column/` |
| `{appId}.pc-cname.xiaoe-tech.com` | 腾讯云备案 CNAME |
| `{appId}.pc-aliyun.xiaoe-tech.com` | 阿里云备案 CNAME |

常见 PC 路径：

| 类型 | 路径模式 |
|------|----------|
| 视频课 | `/p/t_pc/course_pc_detail/video/{resourceId}` |
| 图文 / 音频 / 专栏等 | `/p/t_pc/course_pc_detail/{type}/{resourceId}` |
| 直播 | `/detail/{resourceId}/4?fromH5=true` |

商家若绑定**独立域名**（如 `https://shop.example.com/p/t_pc/...`），路径不变、仅主机名不同；需在 `channel.json` 中**单独追加**该域名规则后重新构建。

### 学员版入口

- `https://study.xiaoe-tech.com/` — 统一登录后进入已购课程

## 白名单规则（`channel.json`）

`blockUrlWhite: true`：未命中下列模式的标签页**不嗅探**。

| 模式 | 覆盖 |
|------|------|
| `https://*.h5.xiaoeknow.com/*` | 各商家 H5 |
| `https://*.h5.xiaoe-tech.com/*` | H5（xiaoe-tech 域） |
| `https://*.h5.xiaoecloud.com/*` | H5（xiaoecloud 域） |
| `https://*.xiaoeknow.com/*` | xiaoeknow 其它子域 |
| `https://*.xet-pc.citv.cn/*` | PC（CITV） |
| `https://*.xet.citv.cn/*` | CITV 课程/H5 |
| `https://*.pc.xiaoe-tech.com/*` | PC 官方域 |
| `https://*.pc-cname.xiaoe-tech.com/*` | PC 腾讯云 CNAME |
| `https://*.pc-aliyun.xiaoe-tech.com/*` | PC 阿里云 CNAME |
| `https://study.xiaoe-tech.com/*` | 学员版 |

## 扩展图标

`icons/` 目录为小鹅通专用图标（蓝底小鹅 + 下载箭头），构建时覆盖 `dist/xiaoetong/img/icon.png`、`icon128.png`、`icon-disable.png`。更换素材后可用 `icon-source.png` 重新导出：

```bash
cd channels/xiaoetong/icons
sips -z 64 64 icon-source.png --out icon.png
sips -z 128 128 icon-source.png --out icon128.png
cp icon.png icon-disable.png   # 或自行做灰度/半透明禁用态
```

## 构建与安装

```bash
npm run build -- xiaoetong
```

Chrome / Edge：扩展管理 → 开发者模式 → 加载已解压 → 选择 `dist/xiaoetong/`。

首次安装会打开 **GPL / 服务说明** 页（`channel-install.html`）。设置页中「屏蔽网址」已隐藏，改为 **渠道白名单（只读）**；`深度搜索` 在本渠道构建中锁定为关闭。

**Popup** 顶部显示渠道名与当前页是否在白名单内。**导入配置** 不会覆盖白名单等锁定项；**导出** 省略锁定项。

**下载 / m3u8 合并**：M3U8 解析器底部默认勾选 **「ffmpeg 转码」**（在线 FFmpeg 合并）；「转为 mp4」为浏览器本地合并，默认不勾选。

发布前请在 `channel.json` 将 `repositoryUrl` 改为你公开的 GPL 仓库地址。

## 维护提示

- 小鹅通改版若新增独立域名，在 `channel.json` 的 `blockUrl` 中追加条目后重新构建并打 tag。
- 仅服务**用户有权访问**的课程内容；遵守平台服务条款与著作权法。
- 商家**自定义独立域名**无法通配，按店铺追加 `https://该域名/*` 即可。

## 合规

本渠道配置为 GPL 源码的一部分；商业收费说明见 [docs/SERVICE.md](../../docs/SERVICE.md).
