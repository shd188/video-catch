# 阿里云部署指南（heidilabs.cn）

适用于：订阅 API（`server/`）+ GPL 源码仓库 [shd188/vidio-catch](https://github.com/shd188/vidio-catch)。

建议子域：**`api.heidilabs.cn`** → 激活码与版本下载 API。

---

## 第 0 步：备案与域名（中国大陆）

- 域名 `heidilabs.cn` 在阿里云购买后，若服务器在**中国大陆**且要对公网提供 Web 服务，通常需要 **[ICP 备案](https://beian.aliyun.com/)**（约 1～2 周）。
- 备案完成前，可先用 **服务器公网 IP + 端口** 在本地测试，或服务器放在**香港**等地（政策以阿里云当前说明为准）。

---

## 第 1 步：把代码推到 GitHub

你当前仓库是空的，在**本机**项目根目录执行：

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"

git remote -v
# 若仍是 cat-catch 上游，增加你的仓库：
git remote add publish https://github.com/shd188/vidio-catch.git
# 或改名：git remote rename origin upstream && git remote add origin https://github.com/shd188/vidio-catch.git

git add .
git commit -m "Initial: cat-catch channels, xiaoetong, license server"
git push -u publish main
# 若默认分支是 master，改成：git push -u publish master
```

推送后打开 https://github.com/shd188/vidio-catch 应能看到完整源码（GPL）。

**不要**把 `server/.env`、`server/data/` 推上去（已在 `.gitignore`）。

---

## 第 2 步：阿里云控制台

### 2.1 安全组（必做）

ECS → 你的实例 → **安全组** → 入方向添加：

| 端口 | 来源 | 说明 |
|------|------|------|
| 22 | 你的办公 IP | SSH（不要用 0.0.0.0/0 长期开放 22） |
| 80 | 0.0.0.0/0 | HTTP（申请证书用） |
| 443 | 0.0.0.0/0 | HTTPS |

**不要**对公网开放 8787；API 只通过 Nginx 443 反代。

### 2.2 域名解析

阿里云 → **云解析 DNS** → `heidilabs.cn` → 添加记录：

| 记录类型 | 主机记录 | 记录值 |
|----------|----------|--------|
| A | api | 你的 ECS **公网 IP** |

生效后：`api.heidilabs.cn` → 服务器。

验证（本机）：

```bash
ping api.heidilabs.cn
```

---

## 第 3 步：SSH 登录服务器

```bash
ssh root@你的公网IP
# 或 ssh ecs-user@...（按阿里云创建实例时提示的用户名）
```

建议首次：

```bash
apt update && apt upgrade -y
apt install -y git nginx certbot python3-certbot-nginx curl
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v   # 应 v18+
```

---

## 第 4 步：部署订阅 API

### 4.1 拉代码

```bash
mkdir -p /opt/vidio-catch && cd /opt/vidio-catch
git clone https://github.com/shd188/vidio-catch.git .
```

### 4.2 配置环境变量

```bash
cd server
cp .env.example .env
nano .env
```

填入（按你的实际修改 `ADMIN_API_KEY`）：

```env
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=用_openssl_rand_hex_32_生成
PUBLIC_BASE_URL=https://api.heidilabs.cn
DATABASE_PATH=/opt/vidio-catch/server/data/licenses.db
RELEASES_DIR=/opt/vidio-catch/server/data/releases
CORS_ORIGIN=*
```

生成密钥（在服务器或本机均可）：

```bash
openssl rand -hex 32
```

### 4.3 安装并初始化

```bash
npm install --production
npm run init-db
```

### 4.4 systemd 开机自启

```bash
sudo tee /etc/systemd/system/vidio-catch-api.service << 'EOF'
[Unit]
Description=Vidio-Catch License API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/vidio-catch/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now vidio-catch-api
sudo systemctl status vidio-catch-api
curl -s http://127.0.0.1:8787/health
```

应返回 `{"ok":true,...}`。

---

## 第 5 步：Nginx + HTTPS

```bash
sudo tee /etc/nginx/sites-available/vidio-catch-api << 'EOF'
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

sudo ln -sf /etc/nginx/sites-available/vidio-catch-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**备案且域名已解析** 后申请证书：

```bash
sudo certbot --nginx -d api.heidilabs.cn
```

本机验证：

```bash
curl https://api.heidilabs.cn/health
```

---

## 第 6 步：创建激活码与发布 zip

在**服务器**上：

```bash
cd /opt/vidio-catch/server

# 给客户发码
npm run license:create -- --channel xiaoetong --email customer@example.com --expires 2027-12-31
# 记下输出的 CC-XXXX-XXXX-XXXX
```

发布扩展包（先在**本机**构建，再上传）：

**本机：**

```bash
cd "/Users/heidi/code/Browser Extensions/video-catch"
npm run build -- xiaoetong
cd dist/xiaoetong && zip -r ../../releases/xiaoetong-2.6.9.zip .
```

**上传到服务器：**

```bash
scp releases/xiaoetong-2.6.9.zip root@你的IP:/opt/vidio-catch/server/data/releases/xiaoetong/
```

**服务器登记版本：**

```bash
cd /opt/vidio-catch/server
npm run release:create -- --channel xiaoetong --version 2.6.9 --file xiaoetong-2.6.9.zip --notes "小鹅通渠道首版"
```

---

## 第 7 步：扩展渠道配置（本机）

确认 `channels/xiaoetong/channel.json` 已为：

```json
"repositoryUrl": "https://github.com/shd188/vidio-catch",
"license": { "apiBase": "https://api.heidilabs.cn", ... }
```

然后：

```bash
npm run build -- xiaoetong
```

用户加载 **`dist/xiaoetong`**，安装页输入激活码；Popup 可检查更新并下载 zip。

**GPL：** 在 GitHub Release 或网页同时提供**同版本源码**（tag `xiaoetong-v2.6.9` + 说明）。

---

## 第 8 步：检查清单

- [ ] https://api.heidilabs.cn/health 正常
- [ ] 激活码能在安装页激活成功
- [ ] `channels/xiaoetong/channel.json` 与线上 `apiBase` 一致
- [ ] 扩展 `manifest` 含 `https://api.heidilabs.cn/*`（构建后自动加入）
- [ ] 未把 `.env` 提交到 GitHub
- [ ] 备案（若大陆服务器 + 域名对外服务）

---

## 常见问题

**扩展仍连本地 127.0.0.1**  
→ 未用最新 `dist/xiaoetong` 构建，或 `apiBase` 未改。

**certbot 失败**  
→ 域名未解析到本机、80 端口未开、或备案未通过导致 80 被拦。

**下载 zip 403**  
→ 激活码未激活、设备超限、或 `releases/xiaoetong/` 下文件名与 `release:create` 不一致。

---

## 日常运维命令（服务器）

```bash
cd /opt/vidio-catch && git pull
cd server && npm install --production
sudo systemctl restart vidio-catch-api
```

创建激活码：`npm run license:create -- --channel xiaoetong --email ...`
