# Video-Catch · 渠道版视频下载扩展

基于开源浏览器扩展 [Cat-Catch（猫抓）](https://github.com/xifangczy/cat-catch) 的 **GPL 渠道构建**：按站点白名单打包、定制 UI 与文案，并配套激活与版本发布后台，用于合法场景下的课程/会议视频辅助下载。

> 本仓库：**https://github.com/shd188/video-catch**  
> 订阅 API 示例：`https://api.shentongxue.online`（以各渠道 `channel.json` 中 `apiBase` 为准）

## 功能概览

| 能力 | 说明 |
|------|------|
| 资源嗅探 | 继承猫抓核心：列出当前页面媒体资源，支持 m3u8/mp4 等常见格式 |
| 渠道白名单 | 仅对 `channels/<id>/` 中配置的域名启用扩展能力，降低误用风险 |
| 渠道定制 | 扩展名、图标、安装说明、Popup/设置页 UI（见 [docs/UI-CUSTOMIZATION.md](docs/UI-CUSTOMIZATION.md)） |
| 激活与更新 | 可选联网校验激活码、检查新版本（`server/` 专有后台，不随 GPL 扩展强制分发） |

### 当前渠道

| 渠道 ID | 显示名 | 说明 |
|---------|--------|------|
| `xiaoetong` | 小鹅通 | 主试点渠道，见 [channels/xiaoetong/README.md](channels/xiaoetong/README.md) |
| `tencentmeeting` | 腾讯会议 | 基础白名单骨架，见 [channels/tencentmeeting/](channels/tencentmeeting/) |

## 快速开始

**环境**：Node.js ≥ 18

```bash
git clone https://github.com/shd188/video-catch.git
cd video-catch
npm run build -- xiaoetong
```

在 Chrome / Edge 打开 `chrome://extensions` → 开启「开发者模式」→「加载已解压的扩展程序」→ 选择 `dist/xiaoetong/`。

**给最终用户的安装与使用说明**（可随 zip 或邮件发给客户）：[docs/USER-GUIDE.md](docs/USER-GUIDE.md)

构建其它渠道：

```bash
npm run build -- tencentmeeting
```

详细步骤见 [docs/BUILD.md](docs/BUILD.md)。

### 激活与发布后台（可选）

```bash
cd server
cp .env.example .env   # 配置 ADMIN_TOKEN、PUBLIC_BASE_URL 等
npm install
npm run init-db
npm start
```

管理界面：`/admin/`。部署说明见 [docs/SERVER.md](docs/SERVER.md)、[docs/DEPLOY-UBUNTU-HK.md](docs/DEPLOY-UBUNTU-HK.md)。

## 文档索引

| 文档 | 内容 |
|------|------|
| [README-GPL-CHANNELS.md](README-GPL-CHANNELS.md) | 渠道分发模式与文档导航 |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | **GPL 义务与分发检查清单** |
| [docs/SERVICE.md](docs/SERVICE.md) | 付费服务边界（卖服务、不卖专有软件权） |
| [docs/PRIVACY.md](docs/PRIVACY.md) | 订阅 API 隐私说明 |
| [docs/BUSINESS-WORKFLOW.md](docs/BUSINESS-WORKFLOW.md) | 激活码与按渠道发包流程 |
| [docs/UPSTREAM.md](docs/UPSTREAM.md) | 上游版本跟踪与合并策略 |

## 使用声明与法律责任

1. **合法用途**：本工具仅供下载您**拥有版权或已获得授权**的内容。禁止用于下载受版权保护且未经授权的视频、绕过 DRM 或违反平台服务条款的行为。
2. **用户责任**：您须自行判断内容是否可下载，并承担全部法律责任。本软件按「原样」提供，维护者不对任何直接或间接损失负责。
3. **渠道限制**：渠道版仅在配置的白名单域名下工作，不保证适用于任意网站。
4. **拒绝抓取**：若您作为网站运营方不希望本渠道包适配您的域名，请在本仓库提交 Issue，标题格式：`[Opt-Out Request] 您的域名`，并附联系邮箱。核实后将在后续渠道配置中尊重您的意愿（开源更新存在周期，敬请理解）。
5. **隐私**：嗅探与下载数据默认在本地处理；若启用激活/更新，扩展会向配置的 `apiBase` 发送必要请求（激活码、渠道 ID、版本号等），详见 [docs/PRIVACY.md](docs/PRIVACY.md)。**本仓库渠道版与猫抓官方商店版无关联，请勿混淆。**

## 许可证（本仓库分发物）

- 浏览器扩展及其构建产物（含对猫抓的修改、`channels/`、`scripts/` 等随包分发部分）：**[GPL-3.0-or-later](LICENSE)**，见 [NOTICE](NOTICE)。
- 单独部署且**不随扩展分发**的 `server/` 订阅 API：可专有，见 [docs/COMPLIANCE.md](docs/COMPLIANCE.md) 第 5 节。
- 收到扩展或其构建产物的任何人，依法享有 GPL 赋予的运行、研究、修改与再分发权利（包括收费再分发），前提是遵守 GPL 义务（提供对应源码、保留许可证与版权声明等）。

付费购买的是**技术支持、渠道适配与构建交付等服务**，不是「专有软件许可证」。详见 [docs/SERVICE.md](docs/SERVICE.md)。

---

## 上游项目说明

本仓库是在 **[Cat-Catch / 猫抓](https://github.com/xifangczy/cat-catch)** 源代码基础上的修改与渠道打包，**并非**猫抓官方项目，也**不代表**上游作者对本渠道产品的认可或背书。

| 项目 | 说明 |
|------|------|
| 上游仓库 | https://github.com/xifangczy/cat-catch |
| 上游许可证 | GPL-3.0（2.0 版起） |
| 本树基准版本 | 2.6.9（见 `manifest.json`、`docs/UPSTREAM.md`） |
| 上游功能文档 | [README-CAT-CATCH.md](README-CAT-CATCH.md)（猫抓原始中文说明） |

**商标与名称**：「Cat-Catch」「猫抓」指向上游开源项目。本仓库各渠道在 `manifest.json` 中的产品名称（如「小鹅通视频下载」）仅为 GPL 构建的描述性标签，**不暗示**上游作者或相关平台的授权、合作或背书。

**GPL 义务摘要**：分发本扩展构建包时，须同时提供与交付版本一致的对应源码（推荐公开本 Git 仓库或附 `source.zip`）、[LICENSE](LICENSE) 全文、[NOTICE](NOTICE) 及构建说明（[docs/BUILD.md](docs/BUILD.md)）。完整清单见 [docs/COMPLIANCE.md](docs/COMPLIANCE.md)。

**合并上游**：`git remote add upstream https://github.com/xifangczy/cat-catch.git`，流程见 [docs/UPSTREAM.md](docs/UPSTREAM.md)。

感谢猫抓作者及社区维护的开源工作。
