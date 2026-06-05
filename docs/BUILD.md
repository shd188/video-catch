# 构建说明

## 环境

- Node.js 18+（仅用于渠道构建脚本）  
- Chrome / Edge 93+（完整功能建议 104+）  

## 安装

```bash
npm install
```

## 构建渠道扩展

```bash
npm run build -- xiaoetong
```

产物目录：`dist/xiaoetong/`（可直接在浏览器「加载已解压的扩展程序」）。

渠道构建还会：

- 写入 `js/channel-init.js`（白名单锁定）
- 生成 `channel-build.json`（安装页与关于页读取）
- 按 `channelNameZh` 生成扩展名 **`{中文渠道名}视频下载`**，并用 `locales` 覆盖 `_locales` 中的 `catCatch`、描述
- 首次安装打开 `channel-install.html`（若配置了 `installPage`）
- 同步 patch `manifest.firefox.json`（Firefox 侧载）

## 固定扩展 ID（避免升级装成第二个扩展）

渠道构建会自动把 `channels/_signing/extension-key.b64` 写入 `manifest.json` 的 `key` 字段，使各版本 **扩展 ID 一致**。说明见 [channels/_signing/README.md](../channels/_signing/README.md)。

用户升级时应：**覆盖原 `dist/<channel>/` 目录后重新加载**，或 **先移除旧扩展再加载新目录**（不要保留两个同时启用）。

## 打 zip（发布用）

```bash
npm run build -- xiaoetong
npm run pack -- xiaoetong
```

产物：`releases/xiaoetong-<version>.zip`（服务器存档用，含版本号）。

- zip **内部根目录**为渠道名：`xiaoetong/manifest.json` …（解压后文件夹名固定为 `xiaoetong`，无版本号）
- 用户从升级页/API 下载时文件名为 **`xiaoetong.zip`**（由服务端 `Content-Disposition` 指定）

打 crx（与解压版同 ID，可拖入覆盖升级）：

```bash
crx3 -p channels/_signing/private.pem -o releases/xiaoetong-2.7.0.crx dist/xiaoetong/
```

## 开发上游通用版

不跑渠道构建时，根目录加载扩展即可；`js/channel-init.js` 默认为空操作。

## 复现要求（GPL）

发布任一渠道版本时，记录：

- Git commit 或 tag  
- `node -v`  
- 命令：`npm run build -- <channel>`  

客户应能用相同 commit 得到相同 `dist/<channel>/`（除时间戳字段外）。
