# 渠道扩展固定 ID（签名公钥）

## 作用

Chrome 对「加载已解压的扩展程序」默认按**文件夹路径**生成扩展 ID。用户把 zip 解压到**新目录**再加载，会被当成**另一个扩展**，激活数据也不共享。

在 `manifest.json` 中写入固定的 `key`（本目录 `extension-key.b64`）后，**同一渠道所有版本共用同一个扩展 ID**，只要：

1. **推荐**：解压覆盖原目录 → `chrome://extensions` → **重新加载**；或  
2. 解压到新目录 → **先移除旧扩展** → 再「加载已解压」新版（`chrome.storage` 会保留，无需重新激活）

## 文件

| 文件 | 说明 |
|------|------|
| `extension-key.b64` | 公钥（提交到 Git），构建时写入 manifest `key` |
| `private.pem` | 私钥（已在 `.gitignore`，仅本地打 crx 用） |

构建脚本：`npm run build -- <channel-id>` 会自动注入 `key`。

## 重新生成密钥（慎用）

更换密钥会改变扩展 ID，已安装用户需重新加载。仅在首次搭建或密钥泄露时执行：

```bash
openssl genrsa -out channels/_signing/private.pem 2048
openssl rsa -in channels/_signing/private.pem -pubout -outform DER | base64 | tr -d '\n' > channels/_signing/extension-key.b64
```

## 打 crx（可选）

```bash
npm install -g crx3
npm run build -- xiaoetong
crx3 -p channels/_signing/private.pem -o releases/xiaoetong-$(node -p "require('./dist/xiaoetong/manifest.json').version").crx dist/xiaoetong/
```

同一私钥打的 crx 与解压版扩展 ID 一致，拖入 `chrome://extensions` 可覆盖升级。
