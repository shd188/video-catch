# GPL 渠道分发仓库说明

本仓库在 [Cat-Catch](https://github.com/xifangczy/cat-catch) 基础上增加**多渠道白名单构建**与**合规/服务文档**，用于「开源扩展 + 付费技术支持」模式。

## 快速开始

| 文档 | 内容 |
|------|------|
| [docs/NEXT-STEPS.md](docs/NEXT-STEPS.md) | **下一步行动清单（建议先看）** |
| [docs/DEPLOY-ALIYUN.md](docs/DEPLOY-ALIYUN.md) | **阿里云 + heidilabs.cn 分步部署** |
| [docs/SERVER.md](docs/SERVER.md) | 激活码 / 更新后台部署 |
| [docs/COMPLIANCE.md](docs/COMPLIANCE.md) | GPL 义务、分发检查清单 |
| [docs/SERVICE.md](docs/SERVICE.md) | 付费服务边界（卖什么、不卖什么） |
| [docs/PRIVACY.md](docs/PRIVACY.md) | 订阅 API 隐私说明 |
| [docs/BUILD.md](docs/BUILD.md) | 构建与复现 |
| [docs/UPSTREAM.md](docs/UPSTREAM.md) | 上游版本跟踪 |
| [channels/](channels/) | 各渠道 GPL 配置（公开） |
| [server/](server/) | 专有订阅 API（不 GPL） |

### 试点：小鹅通

```bash
npm run build -- xiaoetong
# 在 Chrome 加载 dist/xiaoetong/
```

说明：[channels/xiaoetong/README.md](channels/xiaoetong/README.md)

渠道版特性：安装说明页（GPL/服务）、设置页白名单只读、Popup 白名单状态条、导入/导出保护锁定项、Firefox manifest 同步构建、中文扩展名（`locales` 配置）。

## 许可证

- 本仓库分发物：**GPL-3.0-or-later**（见 [LICENSE](LICENSE)、[NOTICE](NOTICE)）
- 上游 Cat-Catch：GPL-3.0

## 与上游 README 的关系

通用功能介绍仍以 [README.md](README.md)（猫抓官方说明）为准；**商业化与渠道构建**以本页及 `docs/` 为准。
