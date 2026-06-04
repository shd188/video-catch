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
- 按 `channel.json` → `locales` 覆盖 `_locales` 中的扩展名称与描述
- 首次安装打开 `channel-install.html`（若配置了 `installPage`）
- 同步 patch `manifest.firefox.json`（Firefox 侧载）

## 打 crx / zip（可选）

与上游一致，可使用 [justfile](../justfile) 在 `dist/xiaoetong/` 目录上执行打包；或：

```bash
cd dist/xiaoetong && zip -r ../../releases/xiaoetong-$(node -p "require('./manifest.json').version").zip .
```

## 开发上游通用版

不跑渠道构建时，根目录加载扩展即可；`js/channel-init.js` 默认为空操作。

## 复现要求（GPL）

发布任一渠道版本时，记录：

- Git commit 或 tag  
- `node -v`  
- 命令：`npm run build -- <channel>`  

客户应能用相同 commit 得到相同 `dist/<channel>/`（除时间戳字段外）。
