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
sed -i 's|/opt/vidio-catch|/opt/video-catch|g' .env
grep -E '^(DATABASE_PATH|RELEASES_DIR)=' .env
sed -i 's|/opt/vidio-catch|/opt/video-catch|g' /etc/systemd/system/video-catch-api.service 2>/dev/null
systemctl daemon-reload
```

---

## 5. 配置订阅 API

```bash
cd /opt/video-catch/server
cp .env.example .env
```

编辑 `.env`（无 `nano` 时用 `vi .env`，或下面 `sed` 改路径）：

```env
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=粘贴下面命令生成的随机串
PUBLIC_BASE_URL=https://api.heidilabs.cn
DATABASE_PATH=/opt/video-catch/server/data/licenses.db
RELEASES_DIR=/opt/video-catch/server/data/releases
CORS_ORIGIN=*
```

一键写入路径（无需 nano）：

```bash
cd /opt/video-catch/server
sed -i 's|/opt/vidio-catch|/opt/video-catch|g' .env
sed -i 's|^DATABASE_PATH=.*|DATABASE_PATH=/opt/video-catch/server/data/licenses.db|' .env
sed -i 's|^RELEASES_DIR=.*|RELEASES_DIR=/opt/video-catch/server/data/releases|' .env
grep -E '^(HOST|PORT|DATABASE_PATH|RELEASES_DIR|PUBLIC_BASE_URL)=' .env
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

### `Connection refused` 或 curl 8787 无响应

说明 **8787 上没有 API 在监听**（服务未启动或启动后立即崩溃）。按顺序做：

```bash
cd /opt/video-catch/server
pwd
ls -la src/index.js node_modules/better-sqlite3 2>&1
node src/index.js
```

另开 SSH 窗口再 `curl -s http://127.0.0.1:8787/health`。前台能跑通后：

```bash
# Ctrl+C 停掉前台 node，再交给 systemd
sudo systemctl restart video-catch-api
systemctl status video-catch-api
```

若 `node src/index.js` 报错，见下表；若 systemd 仍失败，执行 `journalctl -u video-catch-api -n 50 --no-pager`。

### `curl http://127.0.0.1:8787/health` 无任何输出（非 refused）

`curl -s` 会隐藏部分错误，请用带输出的命令排查：

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
vi /etc/systemd/system/video-catch-api.service
systemctl daemon-reload && systemctl enable --now video-catch-api
```

**排查**：是否曾创建过旧名 `video-catch-api` 或 `cat-catch-api`？

```bash
systemctl list-unit-files | grep -E 'video-catch|cat-catch'
```

---


## 7. Nginx 反代

> **若服务器装了宝塔/aaPanel**（配置在 `/www/server/nginx/conf/nginx.conf`），不要用 `systemctl nginx` 和 `/etc/nginx/conf.d/`。在面板里为站点 `api.heidilabs.cn` 添加反向代理到 `127.0.0.1:8787`，并在「伪静态」或自定义配置里加入 `/.well-known/acme-challenge/` 的 `root /var/www/certbot;`（见第 8 节 403 说明）。重载用：`/www/server/nginx/sbin/nginx -s reload` 或面板「重载配置」。

**先安装 Nginx**（Alibaba Cloud Linux 3 默认仓库常 **exclude 掉 nginx**，直接 `dnf install nginx` 会报 `Unable to find a match`）

```bash
# 查看是否被排除
grep -i exclude /etc/dnf/dnf.conf /etc/yum.conf 2>/dev/null

# 方式 A（优先）：ACL 已自带 epel-aliyuncs-release，不要再装 epel-release（会冲突）
rpm -q epel-aliyuncs-release || dnf install -y epel-aliyuncs-release
dnf install -y nginx --disableexcludes=all

# 若曾误装冲突，可先：dnf remove -y epel-release 2>/dev/null; 保留 epel-aliyuncs-release

# 方式 A 仍失败时，用模块流：
dnf module list nginx
dnf module enable nginx:1.20 -y 2>/dev/null || dnf module enable nginx:1.22 -y
dnf install -y nginx --disableexcludes=all

# 方式 B：官方 Nginx 源（CentOS 8 / AL8 兼容）
cat > /etc/yum.repos.d/nginx.repo << 'EOF'
[nginx-stable]
name=nginx stable repo
baseurl=https://nginx.org/packages/centos/8/$basearch/
gpgcheck=1
enabled=1
gpgkey=https://nginx.org/keys/nginx_signing.key
module_hotfixes=true
EOF
dnf clean all && dnf makecache
dnf install -y nginx
```

安装成功后：

```bash
ls -la /etc/nginx/nginx.conf
nginx -v
mkdir -p /etc/nginx/conf.d
systemctl enable --now nginx
```

若 **`Job for nginx.service failed`**（启动失败），在服务器执行：

```bash
nginx -t
systemctl status nginx.service -l --no-pager
journalctl -u nginx -n 40 --no-pager
ss -lntp | grep ':80 '
```

| 日志关键词 | 处理 |
|------------|------|
| `bind() to 0.0.0.0:80 failed (98: Address already in use)` | **80 已被占用**（见下节「80 被占用」） |
| `nginx.conf` syntax error | 按 `nginx -t` 提示改配置；误改的主配置用 `rpm -V nginx` 或重装 `dnf reinstall nginx` |
| `conflicting server name` / `duplicate default` | 只保留一个 `default_server`；禁用 `default.conf`（见下文） |
| `Permission denied` / 日志目录 | `mkdir -p /var/log/nginx && chown nginx:nginx /var/log/nginx` |

配置无误后再：`systemctl start nginx && systemctl status nginx`

### 80 被占用（`Address already in use`）

```bash
ss -lntp | grep ':80 '
# 或
lsof -i :80
```

常见占用与处理：

| 进程 | 处理 |
|------|------|
| `httpd`（Apache） | `systemctl stop httpd && systemctl disable httpd`，再 `systemctl start nginx` |
| 已在跑的 `nginx` | 可能重复安装：`systemctl status nginx`；或旧实例：`kill` 旧 master 后 `systemctl start nginx` |
| `tengine` | 阿里云有时预装：`systemctl stop tengine && systemctl disable tengine` |
| 其他 | 确认非业务后 `kill <PID>`，或把反代写在**已占用 80 的服务**里（见下） |

若 **必须保留** 当前占 80 的程序（例如已是 Nginx/Tengine），不要另起一套 nginx：在**现有**配置的 `server` 里加 `proxy_pass http://127.0.0.1:8787`，`nginx -t && systemctl reload <该服务名>`。

若写入反代时报 **`conf.d/... No such file or directory`**，先创建目录（部分环境安装后没有 `conf.d`）：

```bash
mkdir -p /etc/nginx/conf.d
grep -r 'include' /etc/nginx/nginx.conf
# 应包含一行：include /etc/nginx/conf.d/*.conf;
# 若没有，在 http { } 内追加：include /etc/nginx/conf.d/*.conf;
```

```bash
cat > /etc/nginx/conf.d/video-catch-api.conf << 'EOF'
server {
    listen 80 default_server;
    server_name api.heidilabs.cn;

    # Let's Encrypt 验证路径（必须在 location / 之前，否则被反代到 8787 会 403）
    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

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

mkdir -p /var/www/certbot

nginx -t
systemctl enable --now nginx
systemctl reload nginx
```

**关掉系统自带的默认站点**（否则带 `Host: api.heidilabs.cn` 仍可能落到欢迎页，返回 **404**）：

```bash
for f in /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/welcome.conf; do
  [ -f "$f" ] && mv "$f" "${f}.disabled.$(date +%s)"
done
nginx -t && systemctl reload nginx
```

确认反代配置已加载：

```bash
nginx -T 2>/dev/null | grep -E 'server_name|proxy_pass|video-catch' | head -20
ls -la /etc/nginx/conf.d/video-catch-api.conf
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

### ① 正常、② 仍 404 时

```bash
# 必须能先看到 proxy_pass 到 8787
nginx -T 2>/dev/null | grep -A3 'api.heidilabs.cn'

# 禁用 default.conf / welcome.conf 后重载（见上一段 for 循环）
curl -sv -H "Host: api.heidilabs.cn" http://127.0.0.1/health 2>&1 | tail -5

# 若还是 404，用本机 IP 直连域名测（确认命中你的 server 块）
curl -s http://api.heidilabs.cn/health
```

若 `nginx -T` 里**没有** `api.heidilabs.cn`，说明 `video-catch-api.conf` 未生效：检查文件名是否在 `conf.d/`、主配置是否有 `include /etc/nginx/conf.d/*.conf;`。

若 8787 正常、禁用 default 后仍 404，把 `nginx -T | head -80` 输出保存排查。

---

## 8. HTTPS 证书（需域名已解析、80 可访问）

**前置条件**（缺一不可）：

1. 第 7 节 Nginx 已安装，且 `nginx -t` 成功  
2. `curl -s http://127.0.0.1:8787/health` 有 JSON（Node 已起）  
3. 安全组已放行 **80、443**；域名 `api.heidilabs.cn` 已解析到本机公网 IP  

```bash
nginx -t && systemctl status nginx
curl -s -H "Host: api.heidilabs.cn" http://127.0.0.1/health
```

### 用 certbot 申请证书

ACL 已有 `epel-aliyuncs-release` 时**不要**再装 `epel-release`（会冲突）。

```bash
dnf install -y certbot python3-certbot-nginx
# 避免交互时 UnicodeDecodeError：用英文 locale + 非交互参数
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
dnf install -y glibc-langpack-en 2>/dev/null || true

# 推荐：webroot（与上面 location 配合，避免反代导致 acme 403）
certbot certonly --webroot -w /var/www/certbot -d api.heidilabs.cn \
  --email 你的邮箱@example.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive

# 让 certbot 自动改 Nginx 启用 HTTPS
certbot install --cert-name api.heidilabs.cn
```

将 `你的邮箱@example.com` 换成真实邮箱（如 `shd_di@163.com`）。

申请前自测（应返回文件内容，不能 403/404）：

```bash
mkdir -p /var/www/certbot/.well-known/acme-challenge
echo test > /var/www/certbot/.well-known/acme-challenge/ping
curl -s http://api.heidilabs.cn/.well-known/acme-challenge/ping
# 应输出 test
```

若仍报错，见下节。

成功后：

```bash
curl https://api.heidilabs.cn/health
```

证书自动续期：

```bash
systemctl enable --now certbot-renew.timer
```

### certbot 报 `UnicodeDecodeError` / `utf-8 codec can't decode`

多为 **locale 非 UTF-8** 或 Nginx 配置含异常编码。在服务器执行：

```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8
localectl set-locale LANG=en_US.UTF-8 2>/dev/null || true

# 确认反代配置为纯 ASCII（不要用中文注释）
file /etc/nginx/conf.d/video-catch-api.conf
nginx -t

certbot --nginx -d api.heidilabs.cn \
  --email shd_di@163.com \
  --agree-tos --no-eff-email --non-interactive -v
```

### 宝塔 SSL 403 必做（面板申请证书失败时）

**办法 A — 申请时暂时关掉反代（最简单）**

1. 宝塔 → **网站** → `api.heidilabs.cn` → **反向代理** → **删除**或关闭全部代理规则  
2. **SSL** → **Let's Encrypt** → 重新申请（验证文件会写在网站目录，如 `/www/wwwroot/api.heidilabs.cn`）  
3. 申请成功后 → **强制 HTTPS** → 再 **反向代理** 添加：`http://127.0.0.1:8787`  
4. **配置文件**里在 `server {` 内、反代 `include` **之前**保留：

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /www/wwwroot/api.heidilabs.cn;
    default_type "text/plain";
    allow all;
}
```

（路径以宝塔 **网站目录** 为准。）

**办法 B — 不关反代，只加 location**

网站 → **配置文件**，在**第一行** `include` 反代之前插入上面 `location` 块，`root` 填面板显示的网站目录 → 保存 → **重载 Nginx**。

自测（必须返回验证字符串或 `test`，不能 403）：

```bash
echo test > /www/wwwroot/api.heidilabs.cn/.well-known/acme-challenge/ping
mkdir -p /www/wwwroot/api.heidilabs.cn/.well-known/acme-challenge
curl -s http://api.heidilabs.cn/.well-known/acme-challenge/ping
```

另关闭：网站 **防火墙**、**防跨站**、**Nginx 防火墙**（申请完可再开）。

**办法 C — DNS 验证**：宝塔 SSL 若支持 **DNS** 方式，在域名 DNS 添加 TXT 记录，不经过 80 端口，可避开 403。

### 宝塔提示「域名暂时无法访问」+ 403

表示宝塔从外网访问 `http://api.heidilabs.cn` 失败（比 acme 路径更严重）。按序排查：

```bash
# 在服务器上
dig +short api.heidilabs.cn
curl -sI http://127.0.0.1/ -H "Host: api.heidilabs.cn" | head -5
ss -lntp | grep ':80 '
/etc/init.d/nginx status || /www/server/nginx/sbin/nginx -t
```

| 检查项 | 要求 |
|--------|------|
| DNS | `dig` 结果 = 本机公网 IP（如 123.57.226.210） |
| 阿里云安全组 | 入方向 **80、443** 对 0.0.0.0/0 放行 |
| Nginx | `:80` 有 `nginx` 监听；面板里 Nginx **已启动** |
| 本机 HTTP | `curl -H "Host: api.heidilabs.cn" http://127.0.0.1/` 有响应（非 connection refused） |

**外网自测**（在你 Mac 上）：`curl -v http://api.heidilabs.cn/` 应能连上（不要只剩 403/超时）。

**为申请 SSL 的极简站点（建议做一次）**：

1. 宝塔 → 网站 → `api.heidilabs.cn` → **反向代理全部删除**  
2. 网站目录放测试页：`echo ok > /www/wwwroot/api.heidilabs.cn/index.html`  
3. 关闭：网站防火墙、防跨站、宝塔 **系统防火墙** 对 80 的拦截（测完可开）  
4. 外网浏览器打开 `http://api.heidilabs.cn/` 应看到 **ok**  
5. 再 **SSL → Let's Encrypt** 申请 → 成功后再加反代 `127.0.0.1:8787`  

仍失败：用 **standalone**（停 Nginx 几分钟）：见下节「webroot 一直 403 时的兜底」。

### 外网 403 且页面标题为「Non-compliance ICP Filing」/ Server: Beaver

这是 **阿里云大陆 ECS 对未备案域名的 HTTP 拦截**，不是 Nginx 配错。`api.heidilabs.cn` 从公网访问（含 Let's Encrypt、宝塔检测）会固定 403，改 `location`、关反代都无法解决。

**长期**：在阿里云为 `heidilabs.cn` 做 [ICP 备案](https://beian.aliyun.com/)，备案通过并接入域名后，80/443 与 SSL 申请才会正常。

**短期（未备案先要 HTTPS）** — 用 **DNS 验证** 申请证书（不经过 80 端口）：

1. 宝塔 → 网站 → `api.heidilabs.cn` → **SSL** → 若有 **DNS验证** / **阿里云DNS**，按面板添加 TXT 记录  
2. 或 certbot + 阿里云 DNS 插件（域名 DNS 在阿里云时）  
3. 或将 API **迁到香港/新加坡** 等非大陆地域 ECS（无强制备案拦截）

Mac 自测若走代理出现该页，可对比：

```bash
NO_PROXY=api.heidilabs.cn curl -sI http://api.heidilabs.cn/
```

服务器本机 `curl -H "Host: api.heidilabs.cn" http://127.0.0.1/` 可能仍 200，但**外网验证**才会被拦。

备案完成前：扩展 `apiBase` 可暂用 `http://公网IP:8787` 仅作开发（不推荐生产）；生产应完成备案或迁区域 + DNS 证书。

### 宝塔 + certbot webroot 仍 403

命令行 certbot 写的文件在 `/var/www/certbot/`，但宝塔站点配置若**整站反代**到 8787，或没加下面 `location`，外网仍会 **403**。

**推荐**：宝塔 → **网站** → `api.heidilabs.cn` → **SSL** → **Let's Encrypt** → 申请。

若面板报 **验证失败 / acme-challenge 403**（与命令行 certbot 相同原因）：整站反代到 8787 时，验证文件在网站目录里但外网访问仍进 Node → 403。按下面 **「宝塔 SSL 403 必做」** 操作后再点申请。

若坚持用 certbot：宝塔 → **网站** → `api.heidilabs.cn` → **配置文件**，在 `server {` 内、**任何 `proxy_pass` / include 反代之前**加入：

```nginx
location ^~ /.well-known/acme-challenge/ {
    root /var/www/certbot;
    default_type "text/plain";
    allow all;
}
```

保存 → 面板 **重载 Nginx**。自测（必须返回 `test`，不能 403）：

```bash
mkdir -p /var/www/certbot/.well-known/acme-challenge
echo test > /var/www/certbot/.well-known/acme-challenge/ping
curl -sI http://api.heidilabs.cn/.well-known/acme-challenge/ping | head -5
curl -s http://api.heidilabs.cn/.well-known/acme-challenge/ping
```

再执行 `certbot certonly --webroot -w /var/www/certbot ...`。若仍 403：检查宝塔 **网站防火墙**、**防跨站**、**Nginx 防火墙** 是否拦截该路径。

**webroot 一直 403 时的兜底（临时占用 80 端口）**：

```bash
# 确认 Node 8787 仍在跑即可，停的是 Nginx
/etc/init.d/nginx stop
ss -lntp | grep ':80 '   # 应无输出

export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8
certbot certonly --standalone -d api.heidilabs.cn \
  --email shd_di@163.com --agree-tos --no-eff-email --non-interactive

/etc/init.d/nginx start
# 证书在 /etc/letsencrypt/live/api.heidilabs.cn/
# 宝塔 → 网站 → SSL → 其他证书 → 填入 fullchain.pem / privkey.pem 路径
```

或改用站点目录作 webroot（与宝塔「网站目录」一致，常见 `/www/wwwroot/api.heidilabs.cn`）：

```bash
mkdir -p /www/wwwroot/api.heidilabs.cn/.well-known/acme-challenge
echo test > /www/wwwroot/api.heidilabs.cn/.well-known/acme-challenge/ping
# 配置里：location ^~ /.well-known/acme-challenge/ { root /www/wwwroot/api.heidilabs.cn; }
certbot certonly --webroot -w /www/wwwroot/api.heidilabs.cn -d api.heidilabs.cn ...
```

### 宝塔 Nginx：`invalid PID number "" in nginx.pid`

说明用的是 **面板自带的 Nginx**（`/www/server/nginx/`），且主进程未运行或 `nginx.pid` 为空。不要用系统自带的 `nginx -s reload`（可能指错二进制）。

```bash
ps aux | grep nginx
/www/server/nginx/sbin/nginx -t
rm -f /www/server/nginx/logs/nginx.pid
/www/server/nginx/sbin/nginx
# 或在宝塔面板：软件商店 → Nginx → 启动 / 重载配置
```

站点反代与证书建议在 **宝塔 → 网站 → api.heidilabs.cn → 反向代理 / SSL** 里配置，与 `/etc/nginx` 两套不要混用。

### certbot 报 acme-challenge `403` / `unauthorized`

原因：`location /` 把 `/.well-known/acme-challenge/` 也 **proxy 到了 8787**，Node 返回 403。

处理：在 `video-catch-api.conf` 里为 acme 单独加 `location`（见第 7 节完整配置），`nginx -s reload` 后改用 **webroot** 申请（上节 `certonly --webroot`），不要用会把整站反代的裸 `certbot --nginx` 直到 webroot 自测通过。

### certbot 报 `nginx.conf` 不存在 / nginx plugin not working

说明 **Nginx 未安装或未装全**，不要先跑 certbot，执行：

```bash
dnf install -y nginx
ls /etc/nginx/nginx.conf    # 必须存在
systemctl enable --now nginx
nginx -t
systemctl reload nginx
```

确认第 7 节反代正常后，再执行 `certbot --nginx -d api.heidilabs.cn`。

若仍失败，可改用 webroot（不依赖 nginx 插件解析配置）：

```bash
mkdir -p /var/www/certbot
# 在 server { } 内临时增加：
#   location /.well-known/acme-challenge/ { root /var/www/certbot; }
nginx -t && systemctl reload nginx
certbot certonly --webroot -w /var/www/certbot -d api.heidilabs.cn
# 再手动把 ssl_certificate 写入 nginx 配置，或请运维协助
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
