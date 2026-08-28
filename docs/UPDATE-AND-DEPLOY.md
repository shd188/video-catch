# 每次更新：提交 GitHub + 部署服务器

面向日常改完代码后的固定流程。首次装机见 [OPS-GUIDE.md](OPS-GUIDE.md) / [DEPLOY-UBUNTU-HK.md](DEPLOY-UBUNTU-HK.md)。

---

## 环境速查

| 项 | 值 |
|----|-----|
| 本机仓库 | `"/Users/heidi/code/Browser Extensions/video-catch"` |
| 推送远程 | `publish` → `https://github.com/shd188/video-catch` |
| 线上跟踪分支 | **`master`**（服务器 `git pull` 拉这个） |
| 服务器代码 | `/opt/video-catch` |
| API 运行方式 | **Docker 容器** `video-catch-api`（不是宿主机 npm / systemd） |
| 后台 | https://api.shentongxue.online/admin/ |
| 健康检查 | https://api.shentongxue.online/health |

> **注意**：改动只 push 到 feature 分支、不合并进 `master`，服务器拉不到。后台静态页更新后需 **强制刷新**（Mac：`Cmd+Shift+R`）。

---

## A. 本机：提交并推到 GitHub

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"

# 1. 看改了什么（不要提交 .env、.DS_Store、.cursor/、超大视频除非有意）
git status
git diff

# 2. 暂存相关文件
git add 路径1 路径2 …

# 3. 提交
git commit -m "一句话说明改动原因"

# 4. 推到自有仓库的 master（服务器跟这个分支）
git push publish HEAD:master
```

若当前在 feature 分支，也用上面的 `HEAD:master`，保证 **master 上有这次提交**。

可选：同时更新 feature 远程分支：

```bash
git push publish HEAD
```

验证远程已更新：

```bash
git fetch publish
git log publish/master -1 --oneline
```

---

## B. 服务器：拉代码并重启（Docker）

SSH 登录后：

```bash
cd /opt/video-catch

# 确认在 master
git checkout master
git pull

# 应能看到刚推的那条 commit
git log -1 --oneline

# 重启 API 容器（代码一般是挂载进容器的）
docker restart video-catch-api

# 确认容器在跑
docker ps --filter name=video-catch-api
curl -s https://api.shentongxue.online/health
# 期望含 "ok":true
```

若 `git pull` 有冲突或分支不对：

```bash
git status
git branch -vv
git fetch origin   # 若 remote 叫 origin 指向 shd188/video-catch，按实际改
# 或：
git fetch https://github.com/shd188/video-catch.git
git reset --hard FETCH_HEAD   # 慎用：丢弃服务器上未提交本地改动
docker restart video-catch-api
```

改过 `server/.env` 后同样：`docker restart video-catch-api`。

容器内执行管理命令示例：

```bash
docker exec video-catch-api npm run release:create -- \
  --channel xiaoetong --version 2.6.9 --file xiaoetong-2.6.9.zip --notes "说明"
```

---

## C. 若本次还改了扩展（渠道插件）

只改 `server/` 后台时，做完 **A + B** 即可。

改了扩展逻辑 / `channels/*/channel.json` 时，本机还要打包并发布 zip：

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"

# 例：小鹅通
npm run build -- xiaoetong
npm run pack -- xiaoetong
# 产物：releases/xiaoetong-<version>.zip
```

发布方式（二选一）：

1. **后台上传（推荐）**  
   打开 https://api.shentongxue.online/admin/ → 发布渠道包 → 选渠道、版本号、上传 zip。

2. **scp + 容器内登记**

```bash
# 本机
scp releases/xiaoetong-2.6.9.zip root@服务器IP:/opt/video-catch/server/data/releases/xiaoetong/

# 服务器
docker exec video-catch-api npm run release:create -- \
  --channel xiaoetong --version 2.6.9 --file xiaoetong-2.6.9.zip --notes "更新说明"
```

用户需重新加载扩展或从发货页/更新入口拿新包。

---

## D. 一分钟检查清单

- [ ] 本机 `git push publish HEAD:master` 成功  
- [ ] 服务器 `git log -1` 已是新 commit  
- [ ] `docker ps` 里 `video-catch-api` 为 Up  
- [ ] `/health` 正常  
- [ ] 后台强制刷新后功能可见（如搜索框、北京时间）  
- [ ] 若改了扩展：新 zip 已上传且版本号正确  

---

## 常见踩坑

| 现象 | 原因 | 处理 |
|------|------|------|
| 后台没有新功能 | 只 push 了 feature，master 没更新 | `git push publish HEAD:master` 后再 `git pull` |
| `npm: command not found` | 宿主机没装 Node，API 在 Docker 里 | 用 `docker restart` / `docker exec`，不要在宿主机找 npm |
| `Unit video-catch-api.service not found` | 当前环境用的是 Docker，不是 systemd | `docker restart video-catch-api` |
| 代码已 pull 但页面旧 | 浏览器缓存了 `/admin/` | 强制刷新或无痕窗口 |
| `/health` 502 | 容器挂了或语法错误 | `docker logs video-catch-api --tail 50` |

---

## 不要提交的内容

- `server/.env`、密钥、数据库 `*.db`
- `.DS_Store`、`.cursor/`
- 无意替换的大视频（除非明确要更新 guide 资源）
