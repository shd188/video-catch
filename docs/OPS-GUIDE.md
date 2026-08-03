# 日常运维手册

面向维护 **video-catch** 渠道版与 `api.shentongxue.online` 后台的常用操作速查。详细部署见 [DEPLOY-UBUNTU-HK.md](DEPLOY-UBUNTU-HK.md)、[SERVER.md](SERVER.md)。

---

## 一、环境与地址

| 项 | 值 |
|----|-----|
| 本机仓库 | `"/Users/heidi/code/Browser Extensions/video-catch"` |
| 自有 Git 远程 | `publish` → `git@github.com:shd188/video-catch.git` |
| 上游猫抓 | `origin` → `xifangczy/cat-catch` |
| API 域名 | https://api.shentongxue.online |
| 管理后台 | https://api.shentongxue.online/admin/ |
| 用户说明（公开） | https://api.shentongxue.online/guide/ |
| Guide 视频（OSS） | 见 [GUIDE-VIDEO-OSS.md](GUIDE-VIDEO-OSS.md) |
| 静态落地页 | 仓库 `landing/`（独立托管，不依赖 API） |

**当前渠道**：`quanneng`（全能）、`xiaoetong`（小鹅通）、`tencentmeeting`（腾讯会议）、`feishu`（飞书）

**服务器**（CentOS 7）：代码 `/opt/video-catch`，API 跑在 Docker 容器 `video-catch-api`，Nginx 反代 443 → 8787。

---

## 二、本机 Mac — 构建与打包

进入仓库根目录：

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"
```

### 2.1 构建单个渠道

```bash
npm run build -- xiaoetong
npm run build -- tencentmeeting
npm run build -- feishu
npm run build -- quanneng
```

产物：`dist/<渠道ID>/`，在 Chrome 打开 `chrome://extensions` → 开发者模式 → 加载已解压的扩展程序。

### 2.2 打包 zip（发给客户 / 上传后台）

```bash
npm run pack -- xiaoetong
```

生成：`releases/<渠道ID>-<版本号>.zip`（版本号来自 `manifest.json`，当前基准 **2.6.10**）。  
解压后文件夹名与渠道 ID 一致（如 `xiaoetong/`）。

### 2.3 一次构建并打包全部渠道

```bash
for ch in quanneng xiaoetong tencentmeeting feishu; do
  npm run build -- "$ch" && npm run pack -- "$ch"
done
ls -lh releases/
```

### 2.4 改 API 地址或白名单后

1. 编辑 `channels/<id>/channel.json`（`license.apiBase`、`optionLists.blockUrl` 等）  
2. 重新 `npm run build -- <id>` 和 `npm run pack -- <id>`  
3. 上传新版本到后台（见第四节）

---

## 三、Git 与上游合并

### 3.1 推送到自己的仓库

```bash
git status
git add …
git commit -m "说明"
git push publish master
```

（`publish` 若 HTTPS 报凭据错误，可用：`git push git@github.com:shd188/video-catch.git master`）

### 3.2 拉取上游猫抓更新

```bash
git fetch origin
git merge origin/master
# 若有冲突，解决后 git commit
```

不建议对渠道 fork 使用 `git pull`（无参数），默认会拉 `origin` 而非 `publish`。

### 3.3 服务器拉代码

```bash
ssh root@<服务器IP>
cd /opt/video-catch && git pull
docker restart video-catch-api
```

---

## 四、发布渠道包（新版本）

版本号须与 `manifest.json` 中 `version` 一致（发 2.7.0 前先改 manifest 再 build）。

### 方式 A：管理后台（推荐）

1. 打开 https://api.shentongxue.online/admin/ 并登录  
2. 进入 **发布版本**  
3. 选择渠道、填写版本号、上传 `releases/<渠道>-<版本>.zip`  
4. 填写更新说明并提交  

### 方式 B：命令行（服务器）

本机先把 zip 传到服务器：

```bash
scp releases/xiaoetong-2.6.9.zip root@<服务器IP>:/tmp/
```

在服务器上：

```bash
mkdir -p /opt/video-catch/server/data/releases/xiaoetong
cp /tmp/xiaoetong-2.6.9.zip /opt/video-catch/server/data/releases/xiaoetong/

docker exec video-catch-api npm run release:create -- \
  --channel xiaoetong \
  --version 2.6.9 \
  --file xiaoetong-2.6.9.zip \
  --notes "更新说明"
```

三个渠道把 `xiaoetong` 换成 `tencentmeeting` / `feishu` 各执行一次。

已激活用户若本地版本低于后台最新版，扩展 Popup 会出现更新下载链接。

---

## 五、管理后台 — 激活码

登录：https://api.shentongxue.online/admin/

### 5.1 忘记登录密码

在服务器查看初始备份（若未改过）：

```bash
cat /root/.video-catch-admin-key
# 或
grep ADMIN_API_KEY /opt/video-catch/server/.env
```

若在后台改过密码，以你设置的为准。要重置为 `.env` 里的值：

```bash
docker exec video-catch-api node -e "
const Database=require('better-sqlite3');
const db=new Database('/app/data/licenses.db');
db.prepare(\"DELETE FROM admin_settings WHERE key='password_hash'\").run();
"
docker restart video-catch-api
```

再用 `.env` / `.video-catch-admin-key` 中的密码登录，并在后台重新修改。

### 5.2 批量生成激活码

后台：**激活码** → 选渠道 → 填数量 → 生成（可下载 CSV）。

命令行（在服务器容器内）：

```bash
docker exec -it video-catch-api npm run license:create -- \
  --channel xiaoetong \
  --email customer@example.com \
  --expires 2027-12-31
```

批量：

```bash
docker exec video-catch-api npm run license:create -- \
  --channel feishu --count 100 --expires 2027-12-31
```

（具体参数见 `server/src/cli.js`）

### 5.3 兑换码（经 sph-dl 写入 KV，与激活码并存）

后台页签：**生成兑换码** / **兑换码查询**。

生成时调用 sph-dl 的 `POST /api/admin/codes` 写入 Cloudflare KV，本地 SQLite 仅镜像便于查询。

在 `server/.env` 配置：

```bash
SPH_DL_API_BASE=https://你的-sph-dl域名
SPH_DL_ADMIN_TOKEN=与_sph-dl_的_ADMIN_TOKEN_相同
```

- 套餐：`1` / `5` / `10` / `30` / `50` / `100` 次
- 码格式：`SPH5-A3F9K2B1`（与 sph-dl 一致）
- 「兑换码查询」点刷新会向 sph-dl 同步当前页剩余次数

```bash
# 生成 10 张「5 次」兑换码（走 sph-dl）
docker exec video-catch-api npm run redeem:create -- --pack 5 --count 10 --note 2026-07-批次
```

API（需管理登录 `X-Admin-Key`）：

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/admin/redeem-codes/bulk` | `{ pack, count, note? }` → 调 sph-dl 生成 |
| GET | `/api/admin/redeem-codes` | 列表（`sync=1` 时同步剩余次数） |
| GET | `/api/admin/redeem-codes/stats` | 本地镜像库存统计 |

---

## 六、服务器运维

### 6.1 查看 API 是否正常

```bash
curl -s https://api.shentongxue.online/health
# {"ok":true,"service":"cat-catch-license-server"}

docker ps --filter name=video-catch-api
docker logs video-catch-api --tail 50
```

### 6.2 重启 API

```bash
docker restart video-catch-api
```

### 6.3 修改后台渠道列表

编辑 `/opt/video-catch/server/.env`：

```
ADMIN_CHANNELS=quanneng,xiaoetong,tencentmeeting,feishu
```

然后 `docker restart video-catch-api`。

### 6.4 备份（激活码 + 发布包）

```bash
cd /opt/video-catch/server
tar czf ~/backup-$(date +%F).tar.gz data/licenses.db data/releases/
```

### 6.5 恢复旧库（从旧服务器迁移）

```bash
docker stop video-catch-api
cp licenses.db /opt/video-catch/server/data/licenses.db
docker start video-catch-api
```

---

## 七、新增渠道（ checklist ）

1. 复制 `channels/xiaoetong/` → `channels/<新ID>/`，改 `channel.json`、图标、`signing/extension-key.b64`  
2. `server/.env` 的 `ADMIN_CHANNELS` 加上新 ID  
3. `landing/landing-data.js` 增加落地页条目（可选）  
4. `npm run build -- <新ID>` → `npm run pack -- <新ID>` → 后台上传  
5. `git push publish master`，服务器 `git pull && docker restart video-catch-api`

---

## 八、故障速查

| 现象 | 处理 |
|------|------|
| 访问 `/` 显示 Cannot GET / | 应 302 到 `/guide/`；若异常检查 `server/src/index.js` 根路由并重启容器 |
| `/health` 502 | `docker logs video-catch-api`；常见为语法错误或容器未启动 |
| 后台登录失败 | 确认密码；或按 5.1 重置 |
| 扩展激活失败 | 各渠道 `channel.json` 的 `apiBase` 须为 `https://api.shentongxue.online`，且与服务器 `PUBLIC_BASE_URL` 一致 |
| 上传 zip 后用户下不了 | 确认 `data/releases/<渠道>/` 下有对应 zip，且后台版本号与 manifest 一致 |
| HTTPS 证书过期 | 服务器：`certbot renew && systemctl reload nginx` |
| CentOS 上不要直接装 Node 20 | 本环境用 Docker 跑 API，勿删容器改用 yum 装 node |

---

## 九、相关文档

| 文档 | 用途 |
|------|------|
| [USER-GUIDE.md](USER-GUIDE.md) | 发给最终用户的安装说明 |
| [BUILD.md](BUILD.md) | 构建细节 |
| [SERVER.md](SERVER.md) | API 接口与后台说明 |
| [BUSINESS-WORKFLOW.md](BUSINESS-WORKFLOW.md) | 激活码与商务流程 |
| [UPSTREAM.md](UPSTREAM.md) | 合并上游猫抓 |
| [landing/README.md](../landing/README.md) | 静态落地页部署 |

---

*最后更新：与三渠道（小鹅通 / 腾讯会议 / 飞书）、Docker 部署方式及 v2.6.9 对齐。*
