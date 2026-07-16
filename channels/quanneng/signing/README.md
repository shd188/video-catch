# 全能渠道签名公钥

构建时写入 `manifest.json` 的 `key`，使 **全能渠道各版本** 共用同一扩展 ID。

- `extension-key.b64` — 公钥（提交 Git）
- `private.pem` — 私钥（本地打 crx 用，已被 `.gitignore` 忽略或请勿提交）

**不同渠道必须使用不同密钥**，否则 Chrome 只能保留其中一个扩展。
