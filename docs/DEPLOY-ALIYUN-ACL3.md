# Alibaba Cloud Linux 3 部署命令（复制粘贴）

系统：**Alibaba Cloud Linux 3.2104 LTS 64 位**  
域名：**api.heidilabs.cn**  
仓库：**https://github.com/shd188/vidio-catch.git**

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
mkdir -p /opt/vidio-catch
cd /opt/vidio-catch
git clone https://github.com/shd188/vidio-catch.git .
ls server/src/index.js   # 必须能列出此文件，否则本节未成功
```

若 `ls` 失败，说明代码不在本机，需重新执行本节，不要继续后面的 systemd 步骤。

---

## 5. 配置订阅 API

```bash
cd /opt/vidio-catch/server
cp .env.example .env
```

编辑 `.env`（`nano .env` 或 `vi .env`）：

```env
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=粘贴下面命令生成的随机串
PUBLIC_BASE_URL=https://api.heidilabs.cn
DATABASE_PATH=/opt/vidio-catch/server/data/licenses.db
RELEASES_DIR=/opt/vidio-catch/server/data/releases
CORS_ORIGIN=*
```

生成 `ADMIN_API_KEY`：

```bash
openssl rand -hex 32
```

安装并初始化：

```bash
npm install --production
npm run init-db
curl -s http://127.0.0.1:8787/health
```

---

## 6. systemd 自启

若执行 `systemctl restart vidio-catch-api` 报 **Unit not found**，说明本节尚未做过，请完整执行下面命令（路径按你实际安装目录改）。

先确认 Node 路径与项目目录：

```bash
which node          # 记下路径，常见 /usr/bin/node
ls /opt/vidio-catch/server/src/index.js
```

创建服务（`ExecStart` 与 `WorkingDirectory` 必须与上面一致）：

```bash
NODE=$(which node)
cat > /etc/systemd/system/vidio-catch-api.service << EOF
[Unit]
Description=Vidio-Catch License API
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/vidio-catch/server
Environment=NODE_ENV=production
ExecStart=${NODE} src/index.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now vidio-catch-api
systemctl status vidio-catch-api
```

也可用仓库内模板（`git pull` 后）：

```bash
cp /opt/vidio-catch/server/vidio-catch-api.service /etc/systemd/system/
# 若项目不在 /opt/vidio-catch，编辑 WorkingDirectory 与 ExecStart 中的 node 路径
nano /etc/systemd/system/vidio-catch-api.service
systemctl daemon-reload && systemctl enable --now vidio-catch-api
```

**排查**：是否装过旧名服务 `cat-catch-api`？

```bash
systemctl list-unit-files | grep -E 'vidio|cat-catch'
```

---


## 7. Nginx 反代

```bash
cat > /etc/nginx/conf.d/vidio-catch-api.conf << 'EOF'
server {
    listen 80;
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

本机测（在服务器上）：

```bash
curl -s http://127.0.0.1/health
curl -s -H "Host: api.heidilabs.cn" http://127.0.0.1/health
```

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
cd /opt/vidio-catch/server
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
ssh root@你的IP "mkdir -p /opt/vidio-catch/server/data/releases/xiaoetong"
scp releases/xiaoetong-2.6.9.zip root@你的IP:/opt/vidio-catch/server/data/releases/xiaoetong/
```

服务器登记：

```bash
cd /opt/vidio-catch/server
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
cd /opt/vidio-catch && git pull
cd server && npm install --production
systemctl restart vidio-catch-api
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
