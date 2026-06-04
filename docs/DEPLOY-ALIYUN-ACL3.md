# Alibaba Cloud Linux 3 部署命令（复制粘贴）

系统：**Alibaba Cloud Linux 3.2104 LTS 64 位**  
域名：**api.heidilabs.cn**  
仓库：**https://github.com/shd188/video-catch.git**  
服务器安装目录建议：**`/opt/video-catch`**

前置：DNS 已添加 **A 记录 `api` → ECS 公网 IP**；安全组已放行 **22 / 80 / 443**（不要开放 8787）。

---

## 1. SSH 登录

```bash
ssh root@你的ECS公网IP
```

---

## 2. 系统更新与基础软件

```bash
dnf update -y
dnf install -y git nginx curl policycoreutils-python-utils

# 可选：若启用了 firewalld（与安全组二选一或同时用）
# systemctl status firewalld
# firewall-cmd --permanent --add-service=ssh
# firewall-cmd --permanent --add-service=http
# firewall-cmd --permanent --add-service=https
# firewall-cmd --reload
```

---

## 3. 安装 Node.js 20

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
dnf install -y nodejs
node -v
npm -v
```

---

## 4. 拉取代码

```bash
dnf install -y git
mkdir -p /opt/video-catch
cd /opt/video-catch
git clone https://github.com/shd188/video-catch.git .
ls server/src/index.js   # 必须能列出此文件，否则本节未成功
```

若 `ls` 失败，说明代码不在本机，需重新执行本节，不要继续后面的 systemd 步骤。

**已从旧目录 `vidio-catch` 部署过？** 在服务器执行：

```bash
systemctl stop video-catch-api 2>/dev/null || true
[ -d /opt/vidio-catch ] && [ ! -e /opt/video-catch ] && mv /opt/vidio-catch /opt/video-catch
cd /opt/video-catch/server
# 若 .env 里 DATABASE_PATH / RELEASES_DIR 仍写 vidio-catch，改为 video-catch
grep -n vidio .env 2>/dev/null && nano .env
sed -i 's|/opt/vidio-catch|/opt/video-catch|g' /etc/systemd/system/video-catch-api.service 2>/dev/null
systemctl daemon-reload
```

---

## 5. 配置订阅 API

```bash
cd /opt/video-catch/server
cp .env.example .env
```

编辑 `.env`（`nano .env` 或 `vi .env`）：

```env
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=粘贴下面命令生成的随机串
PUBLIC_BASE_URL=https://api.heidilabs.cn
DATABASE_PATH=/opt/video-catch/server/data/licenses.db
RELEASES_DIR=/opt/video-catch/server/data/releases
CORS_ORIGIN=*
```

生成 `ADMIN_API_KEY`：

```bash
openssl rand -hex 32
```

安装并初始化（**必须在 `server` 目录执行**，在仓库根目录会报 `Missing script: init-db`）：

```bash
cd /opt/video-catch/server
npm install --production
npm run init-db
# 或直接：node src/init-db.js
curl -s http://127.0.0.1:8787/health
```

若已在仓库根目录 `/opt/video-catch`，也可用：`npm run server:init-db`（需最新 `package.json`）。

### `curl http://127.0.0.1:8787/health` 无任何输出

说明 **8787 上没有 API 在监听**（`curl -s` 会隐藏错误）。请用带输出的命令排查：

```bash
curl -v --max-time 3 http://127.0.0.1:8787/health
ss -lntp | grep 8787
systemctl status video-catch-api
journalctl -u video-catch-api -n 50 --no-pager
```

**前台启动看报错**（最有用）：

```bash
cd /opt/video-catch/server
node src/index.js
# 正常应打印 License server http://127.0.0.1:8787，另开终端 curl 8787/health
# 若报错退出，按下面常见项处理
```

| 现象 | 处理 |
|------|------|
| `Cannot find module` / `better-sqlite3` | `dnf install -y gcc-c++ make python3` 后 `cd server && rm -rf node_modules && npm install --production` |
| `EADDRINUSE` | `ss -lntp \| grep 8787` 找到占用进程并 `kill`，或改 `.env` 的 `PORT` |
| `EACCES` / 数据库路径 | 确认 `data/` 可写：`mkdir -p data/releases && chmod -R u+rwX data` |
| systemd `failed` 且 journal 无 node | `which node` 写入 service 的 `ExecStart=$(which node) src/index.js` |
| `WorkingDirectory` 不对 | `systemctl cat video-catch-api` 应为 `.../server` |

服务正常后再执行第 6 节 systemd、第 7 节 Nginx。

---

## 6. systemd 自启

若 `systemctl enable video-catch-api` 报 **Unit file does not exist**，说明本节尚未做过，请完整执行下面命令（路径按你实际安装目录改）。

服务名：**`video-catch-api`**（与仓库名一致）。

先确认 Node 路径与项目目录：

```bash
which node          # 记下路径，常见 /usr/bin/node
ls /opt/video-catch/server/src/index.js
```

创建服务（`ExecStart` 与 `WorkingDirectory` 必须与上面一致）：

```bash
NODE=$(which node)
cat > /etc/systemd/system/video-catch-api.service << EOF
[Unit]
Description=Video-Catch License API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/video-catch/server
Environment=NODE_ENV=production
ExecStart=${NODE} src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now video-catch-api
systemctl status video-catch-api
```

也可用仓库内模板（`git pull` 后）：

```bash
cp /opt/video-catch/server/video-catch-api.service /etc/systemd/system/
# 若项目不在 /opt/video-catch，编辑 WorkingDirectory 与 ExecStart 中的 node 路径
nano /etc/systemd/system/video-catch-api.service
systemctl daemon-reload && systemctl enable --now video-catch-api
```

**排查**：是否曾创建过旧名 `video-catch-api` 或 `cat-catch-api`？

```bash
systemctl list-unit-files | grep -E 'video-catch|cat-catch'
```

---


## 7. Nginx 反代

```bash
cat > /etc/nginx/conf.d/video-catch-api.conf << 'EOF'
server {
    listen 80 default_server;
    server_name api.heidilabs.cn;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 500m;
    }
}
EOF

nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

本机测（在服务器上，**按顺序**）：

```bash
# ① 先测 Node 是否起来（不经过 Nginx）
curl -s http://127.0.0.1:8787/health
# 期望：{"ok":true,"service":"cat-catch-license-server"}
# 若失败：systemctl status video-catch-api && journalctl -u video-catch-api -n 30 --no-pager

# ② 再测 Nginx 反代（需已 reload 上面配置）
curl -s -H "Host: api.heidilabs.cn" http://127.0.0.1/health
curl -s http://127.0.0.1/health
# 若 ① 正常但 ② 返回 404：说明请求没进本 server 块，检查：
#   ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/
#   是否有别的 default_server 抢占了 80 端口
```

**说明**：不带 `Host` 的 `curl http://127.0.0.1/health` 会命中 Nginx 的**默认站点**；若默认站点不是本配置，就会 **404**。上面已加 `default_server`；若仍 404，用带 Host 的那条或先确认 ①。

---

## 8. HTTPS 证书（需域名已解析、80 可访问）

Alibaba Cloud Linux 使用 EPEL 的 certbot：

```bash
dnf install -y epel-release
dnf install -y certbot python3-certbot-nginx
certbot --nginx -d api.heidilabs.cn
```

按提示输入邮箱、同意条款。成功后：

```bash
curl https://api.heidilabs.cn/health
```

证书自动续期：

```bash
systemctl enable --now certbot-renew.timer
```

---

## 9. 管理后台（推荐，替代命令行）

浏览器打开（HTTPS 配置完成后）：

**https://api.heidilabs.cn/admin/**（建议加入浏览器书签，像普通网站一样随时打开）

首次输入 `.env` 里的 **ADMIN_API_KEY** 并勾选 **记住登录**；之后打开同一地址即可直接进入。可：

1. **生成激活码** — 选渠道与数量，下载 CSV  
2. **激活码查询** — 剩余未使用数量  
3. **发布扩展包** — 上传 zip  
4. **版本列表** — 历史发布  

本地调试：`http://127.0.0.1:8787/admin/`（需先 `npm run dev`）

---

## 10. 命令行（可选）

```bash
cd /opt/video-catch/server
npm run license:create -- --channel xiaoetong --email 客户@example.com --expires 2027-12-31
```

---

## 11. 上传扩展 zip（也可用后台上传）

本机 Mac 构建后，在管理后台 **发布扩展包** 页面上传即可。命令行方式：

本机构建：

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"
npm run build -- xiaoetong
mkdir -p releases
cd dist/xiaoetong && zip -r ../../releases/xiaoetong-2.6.9.zip .
```

上传到服务器：

```bash
ssh root@你的IP "mkdir -p /opt/video-catch/server/data/releases/xiaoetong"
scp releases/xiaoetong-2.6.9.zip root@你的IP:/opt/video-catch/server/data/releases/xiaoetong/
```

服务器登记：

```bash
cd /opt/video-catch/server
npm run release:create -- --channel xiaoetong --version 2.6.9 --file xiaoetong-2.6.9.zip --notes "小鹅通渠道"
```

---

## 12. SELinux（若 Nginx 反代 502）

少数实例开启 SELinux 会导致反代失败：

```bash
getenforce
# 若为 Enforcing，可试：
setsebool -P httpd_can_network_connect 1
```

或临时排查：`ausearch -m avc -ts recent`

---

## 常用运维

```bash
cd /opt/video-catch && git pull
cd server && npm install --production
systemctl restart video-catch-api
nginx -t && systemctl reload nginx
```

---

## 与 Ubuntu 文档的区别

| 项目 | ACL 3 | Ubuntu |
|------|-------|--------|
| 包管理 | `dnf` | `apt` |
| Nginx 站点 | `/etc/nginx/conf.d/*.conf` | `sites-available` |
| certbot | `dnf install certbot python3-certbot-nginx` | `apt install certbot python3-certbot-nginx` |

通用说明见 [DEPLOY-ALIYUN.md](./DEPLOY-ALIYUN.md)。
