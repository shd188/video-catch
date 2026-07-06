# Ubuntu 20.04 香港服务器部署（video-catch API）

适用于：**Ubuntu 20.04 x64**、**香港 ECS**（无大陆 ICP 备案拦截）。

| 项 | 你的环境 |
|----|----------|
| 公网 IP | `103.79.186.18` |
| API 域名 | **`api.shentongxue.online`**（推荐子域名） |
| 主域名 | `shentongxue.online`（可只做官网，API 用子域） |
| 代码目录 | `/opt/video-catch` |
| 仓库 | https://github.com/shd188/video-catch.git |

---

## 0. 购买后先做（控制台）

1. **安全组**（入方向，见下表；与截图字段一一对应）  
2. **防火墙**（若开了 UFW，见文档第 2 节）  
2. **DNS**（域名服务商）：添加 **A 记录**  
   - 主机记录：`api`  
   - 记录值：`103.79.186.18`  
   - 生效后：`dig +short api.shentongxue.online` 应返回 `103.79.186.18`  
3. 本机 Mac 自测（**不要走会干扰的 http_proxy**，或设 `NO_PROXY`）：  
   ```bash
   NO_PROXY=api.shentongxue.online curl -sI http://api.shentongxue.online/
   ```

### 安全组怎么填（新增策略 × 3 条）

每条：**规则方向 = 入**，**协议 = 自定义 TCP**（或选「TCP」）。**不要**添加 8787 对公网。

| 用途 | 端口范围 | 授权 IP | 描述（可选） |
|------|----------|---------|--------------|
| SSH 登录 | `22` | **你的上网公网 IP/32**（推荐）；不确定可暂填 `0.0.0.0/0`（全网可连，不安全） | SSH |
| HTTP / 证书验证 | `80` | `0.0.0.0/0` | HTTP |
| HTTPS API / 后台 | `443` | `0.0.0.0/0` | HTTPS |

查本机公网 IP（填授权 IP 用）：浏览器搜「IP」或 Mac 打开 https://ifconfig.me ，假设为 `1.2.3.4`，则授权 IP 填 **`1.2.3.4/32`**。

若装 **宝塔面板**，可再加一条：`8888`，授权 IP 建议 **仅你的 IP/32**（面板入口，不要对全网开放）。

**不要开的端口**：`8787`（Node 只监听 `127.0.0.1`，由 Nginx 反代即可）。

---

## 1. SSH 登录

```bash
ssh root@103.79.186.18
```

---

## 2. 系统更新与基础包

```bash
apt update && apt upgrade -y
apt install -y git curl nginx certbot python3-certbot-nginx ufw
```

可选 UFW（若启用，需放行 SSH 避免锁死）：

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 3. 安装 Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v
npm -v
```

---

## 4. 拉取代码

```bash
mkdir -p /opt/video-catch
cd /opt/video-catch
git clone https://github.com/shd188/video-catch.git .
ls server/src/index.js
```

---

## 5. 配置订阅 API（.env）

```bash
cd /opt/video-catch/server
cp .env.example .env
openssl rand -hex 32
```

将上面生成的随机串写入 `ADMIN_API_KEY`，并执行：

```bash
cat > /opt/video-catch/server/.env << 'EOF'
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=14920c134c3c81ca14752d2edff5d15bfccbea40006b26bce968cc61b63e964b
PUBLIC_BASE_URL=https://api.shentongxue.online
DATABASE_PATH=/opt/video-catch/server/data/licenses.db
RELEASES_DIR=/opt/video-catch/server/data/releases
CORS_ORIGIN=*
ADMIN_CHANNELS=xiaoetong,tencentmeeting,feishu
EOF

chmod 600 /opt/video-catch/server/.env
```

安装依赖并启动测试：

```bash
cd /opt/video-catch/server
npm install --production
npm run init-db
node src/index.js
```

另开 SSH 窗口：

```bash
curl -s http://127.0.0.1:8787/health
```

应返回 `{"ok":true,...}`。回到第一个窗口 `Ctrl+C` 停掉前台进程。

---

## 6. systemd 守护

```bash
cp /opt/video-catch/server/video-catch-api.service /etc/systemd/system/
# 确认 WorkingDirectory=/opt/video-catch/server
sed -i "s|^ExecStart=.*|ExecStart=$(which node) src/index.js|" /etc/systemd/system/video-catch-api.service

systemctl daemon-reload
systemctl enable --now video-catch-api
systemctl status video-catch-api
curl -s http://127.0.0.1:8787/health
```

---

## 7. Nginx 反代（系统 nginx，非宝塔）

先确认 Nginx 已安装且配置目录存在（报 `sites-available: No such file` 时执行前两行）：

```bash
apt install -y nginx
mkdir -p /etc/nginx/conf.d /var/www/certbot
ls /etc/nginx/nginx.conf
```

写入反代（使用 **`conf.d`**，各版本 Ubuntu 通用）：

```bash
cat > /etc/nginx/conf.d/video-catch-api.conf << 'EOF'
server {
    listen 80;
    server_name api.shentongxue.online;

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

# 若存在默认站点，禁用以避免抢 80 端口
rm -f /etc/nginx/sites-enabled/default 2>/dev/null
[ -f /etc/nginx/conf.d/default.conf ] && mv /etc/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf.disabled

nginx -t && systemctl enable nginx && systemctl reload nginx

curl -s -H "Host: api.shentongxue.online" http://127.0.0.1/health
# 应返回 {"ok":true,...}

# 下面这条在服务器上可能无输出（DNS 未生效，或云主机不支持访问本机公网 IP 回环），属常见情况
curl -s http://api.shentongxue.online/health

# 在服务器上更可靠的域名自测：
curl -s --resolve api.shentongxue.online:80:127.0.0.1 http://api.shentongxue.online/health

# 必做：检查 DNS 是否指向本机
dig +short api.shentongxue.online
# 应显示 103.79.186.18

# 最终以外网为准：在你 Mac 上执行
# NO_PROXY=api.shentongxue.online curl -s http://api.shentongxue.online/health
```

---

## 8. HTTPS（Let's Encrypt）

DNS 已生效；**Mac 上** `curl http://api.shentongxue.online/health` 有 JSON 后再申请。

### 安装 certbot 的 nginx 插件（报 `nginx plugin does not appear to be installed` 时必做）

```bash
apt update
apt install -y certbot python3-certbot-nginx
certbot plugins
# 列表中应有 nginx

# 若曾用 snap 装过 certbot，二选一，避免混用：
# snap remove certbot 2>/dev/null
# 或改用：snap install --classic certbot && apt install -y python3-certbot-nginx
```

### 申请证书（nginx 插件）

```bash
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

certbot --nginx -d api.shentongxue.online \
  --email shd_di@163.com \
  --agree-tos \
  --no-eff-email \
  --non-interactive

curl -s https://api.shentongxue.online/health
```

### 仍提示无 nginx 插件 → 用 webroot（不依赖插件）

```bash
mkdir -p /var/www/certbot/.well-known/acme-challenge
echo test > /var/www/certbot/.well-known/acme-challenge/ping
curl -s http://api.shentongxue.online/.well-known/acme-challenge/ping
# 必须输出 test

certbot certonly --webroot -w /var/www/certbot -d api.shentongxue.online \
  --email shd_di@163.com \
  --agree-tos --no-eff-email --non-interactive

certbot install --cert-name api.shentongxue.online
# 或手动在 /etc/nginx/conf.d/video-catch-api.conf 增加 listen 443 ssl 与证书路径

nginx -t && systemctl reload nginx
curl -s https://api.shentongxue.online/health
```

管理后台：**https://api.shentongxue.online/admin/**  
用 `.env` 里的 `ADMIN_API_KEY` 登录（可在后台「修改登录密码」）。

证书续期：

```bash
systemctl status certbot.timer
```

### 浏览器 `ERR_TOO_MANY_REDIRECTS`（重定向过多）

多为 certbot 改 nginx 后出现 **HTTP↔HTTPS 互相 301**。在服务器查看：

```bash
nginx -T 2>/dev/null | grep -n "api.shentongxue.online\|return 301\|listen 443"
ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null
```

**修复**：用下面配置**整体替换** `/etc/nginx/conf.d/video-catch-api.conf`（不要留 certbot 自动插入的重复 `server` 块）：

```bash
cat > /etc/nginx/conf.d/video-catch-api.conf << 'EOF'
server {
    listen 80;
    server_name api.shentongxue.online;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/certbot;
        default_type "text/plain";
        allow all;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name api.shentongxue.online;

    ssl_certificate     /etc/letsencrypt/live/api.shentongxue.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.shentongxue.online/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        client_max_body_size 500m;
    }
}
EOF

nginx -t && systemctl reload nginx
curl -sI http://api.shentongxue.online/health | head -5
curl -s https://api.shentongxue.online/health
```

`curl -sI http://...` 应只有 **一条** `301` 到 `https://`；`curl https://.../health` 应直接返回 JSON，不再跳转。

---

## 9. 本机构建扩展（Mac）

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"
# 确认 channels/xiaoetong/channel.json 里 license.apiBase 为 https://api.shentongxue.online
npm run build -- xiaoetong
```

后台 **发布渠道包** 上传 `dist/xiaoetong` 打的 zip，或见 `docs/SERVER.md`。

---

## 10. 日常更新

```bash
cd /opt/video-catch && git pull
cd server && npm install --production
systemctl restart video-catch-api
```

---

## 故障速查

| 现象 | 处理 |
|------|------|
| `8787` Connection refused | `systemctl status video-catch-api`、`journalctl -u video-catch-api -n 40` |
| HTTP 外网 403 备案页（Beaver） | 香港机不应出现；若出现检查 DNS 是否仍指到大陆旧 IP |
| certbot 403 | 确认 `location ^~ /.well-known` 在 `proxy_pass` 前；`curl` 测 challenge 路径 |
| `/admin/` 无限 301 | 更新代码后 `systemctl restart video-catch-api`；`curl -sI https://api.shentongxue.online/admin/` 应 **200** 且无 `Location` |
| 扩展激活失败 | `apiBase` 与 `PUBLIC_BASE_URL` 必须一致且为 **https** |

---

## 与旧大陆机区别

- 无需大陆 **ICP 备案**  
- 使用 **apt + /etc/nginx/sites-available**，不用宝塔路径 `/www/server/nginx`  
- 域名改为 **`api.shentongxue.online`**，记得改 DNS 与 `channel.json` 后重新 `npm run build -- xiaoetong`
