# 已迁移：请使用各渠道独立签名目录

扩展固定 ID 的公钥已改为 **按渠道存放**：

| 渠道 | 路径 |
|------|------|
| 小鹅通 | `channels/xiaoetong/signing/extension-key.b64` |
| 腾讯会议 | `channels/tencentmeeting/signing/extension-key.b64` |

`npm run build -- <channel-id>` 会优先读取 `channels/<channel-id>/signing/extension-key.b64`；仅当该文件不存在时，才回退读本目录的 `extension-key.b64`（兼容旧构建）。

**每个渠道必须有自己的密钥**，这样用户可同时安装多个渠道扩展。同一渠道内各版本仍共用该渠道的密钥，升级时覆盖原目录后重新加载即可。

本目录 `extension-key.b64` 保留作小鹅通历史回退，与新渠道密钥相同内容的副本已放在 `channels/xiaoetong/signing/`。
