# 腾讯会议渠道签名公钥

与小鹅通 **独立密钥**，安装后扩展 ID 不同，可与 `xiaoetong` 同时启用。

- `extension-key.b64` — 公钥（提交 Git）
- `private.pem` — 私钥（本地打 crx 用，已被 `.gitignore` 忽略）

重新生成（会改变扩展 ID，慎用）：

```bash
openssl genrsa -out channels/tencentmeeting/signing/private.pem 2048
openssl rsa -in channels/tencentmeeting/signing/private.pem -pubout -outform DER | base64 | tr -d '\n' > channels/tencentmeeting/signing/extension-key.b64
```
