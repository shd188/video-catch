# 订阅后台部署指南

本目录 `server/` 为**专有服务**（不随 GPL 扩展分发），用于：

- 按渠道 + 用户发放激活码、绑定设备
- 发布新版本 zip，已激活用户可在扩展内收到更新与下载链接

扩展内的 `js/license-client.js` 为 **GPL-3.0**，用户可自行 fork 并去掉联网校验。

---

## 一、服务器要求

| 项目 | 建议 |
|------|------|
| 系统 | Ubuntu 22.04 / Debian 12（或其它 Linux） |
| 配置 | **1 核 CPU、1GB 内存、10GB 磁盘** 即可起步 |
| 软件 | Node.js **18+**、Nginx（HTTPS 反代）、可选 certbot |
| 域名 | 一个子域，例如 `api.yourdomain.com` |
| 备案 | 在中国大陆对外提供 Web 服务需按法规备案（若适用） |

无需 MySQL：使用 **SQLite** 单文件数据库，备份简单。

---

## 常见问题

### `Failed running 'src/index.js'` / `EADDRINUSE`

表示 **8787 端口已被占用**（例如上次 `npm run dev` 没关，或开了两个终端都在跑）。

```bash
lsof -i :8787
kill <上表中的 PID>
# 然后再
npm run dev
```

若 8787 想留给别的程序，可把 `.env` 的 `PORT` 改为 `8788`，并把 `channels/xiaoetong/channel.json` 里 `license.apiBase` 改成 `http://127.0.0.1:8788`，重新 `npm run build -- xiaoetong`。

---

## 二、本地先试（5 分钟）

```bash
cd server
cp .env.example .env
# 编辑 .env：ADMIN_API_KEY、PUBLIC_BASE_URL

npm install
npm run init-db
npm run dev
```

另开终端测试：

```bash
curl http://127.0.0.1:8787/health

# 创建小鹅通渠道激活码
npm run license:create -- --channel xiaoetong --email user@example.com --expires 2027-12-31

# 构建扩展 zip 后登记版本（先把 zip 拷到 server/data/releases/xiaoetong/）
cp ../releases/xiaoetong-2.6.9.zip server/data/releases/xiaoetong/
npm run release:create -- --channel xiaoetong --version 2.6.9 --file xiaoetong-2.6.9.zip --notes "首次发布"
```

---

## 三、生产部署（推荐步骤）

### 1. 买 VPS 并解析域名

- 将 `api.yourdomain.com` A 记录指向服务器 IP  
- 安全组/防火墙放行 **80、443**（SSH 22 仅你的 IP 更佳）

### 2. 安装 Node 与 Nginx（Ubuntu 示例）

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 3. 上传代码

```bash
sudo mkdir -p /opt/cat-catch-server
sudo chown $USER:$USER /opt/cat-catch-server
# 在本机 rsync 或 git clone 到 /opt/cat-catch-server/server
cd /opt/cat-catch-server/server
cp .env.example .env
nano .env
```

**.env 生产示例：**

```env
HOST=127.0.0.1
PORT=8787
ADMIN_API_KEY=你的超长随机密钥
PUBLIC_BASE_URL=https://api.yourdomain.com
DATABASE_PATH=/opt/cat-catch-server/server/data/licenses.db
RELEASES_DIR=/opt/cat-catch-server/server/data/releases
CORS_ORIGIN=*
```

```bash
npm install --production
npm run init-db
```

### 4. systemd 守护进程

服务名：**`video-catch-api`**（与 `docs/DEPLOY-ALIYUN-ACL3.md` 一致）。若 `Unit file does not exist`，说明尚未创建，需先 `enable --now`。

```bash
sudo cp /opt/vidio-catch/server/video-catch-api.service /etc/systemd/system/
# 按实际路径编辑 WorkingDirectory（默认 /opt/vidio-catch/server）
sudo sed -i "s|ExecStart=.*|ExecStart=$(which node) src/index.js|" /etc/systemd/system/video-catch-api.service
sudo systemctl daemon-reload
sudo systemctl enable --now video-catch-api
sudo systemctl status video-catch-api
```

### 5. Nginx + HTTPS

```bash
sudo tee /etc/nginx/sites-available/cat-catch-api << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;
    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/cat-catch-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.yourdomain.com
```

### 6. 扩展侧配置

编辑 `channels/xiaoetong/channel.json`：

```json
"license": {
  "apiBase": "https://api.yourdomain.com",
  "checkIntervalHours": 24,
  "strict": false
}
```

重新构建：

```bash
cd ..   # 仓库根
npm run build -- xiaoetong
```

将 `dist/xiaoetong` 打成 zip 上传到服务器 `data/releases/xiaoetong/`，再执行 `release:create`。

---

## 管理后台（Web）

部署后访问（可加入书签，随时打开）：`https://你的API域名/admin/`  
无尾斜杠会自动跳转到 `/admin/`。页面常驻，勾选 **记住登录** 后关闭浏览器再开仍保持登录（密码存于本机浏览器，勿在公共电脑勾选）。

**管理登录密码**（`ADMIN_API_KEY`）只用于后台登录，与客户激活码无关。首次用 `.env` 中的值登录；可在后台 **「修改登录密码」** 更换（保存到数据库）。

忘记新密码时，在服务器执行：

```bash
cd /opt/vidio-catch/server
sqlite3 data/licenses.db \"DELETE FROM admin_settings WHERE key='password_hash';\"
# 在 .env 设置新的 ADMIN_API_KEY=... 后
systemctl restart video-catch-api
```

再用 `.env` 里的新密码登录，并建议在后台再次修改为你好记的密码。

功能：

- **生成激活码**：选渠道、填数量（如 1000），生成后自动下载 CSV；页面显示该渠道「未使用」剩余数量，快用完时补生成一批
- 激活码列表查询、上传 zip 发布版本（无需命令行）

统计接口：`GET /api/admin/licenses/stats?channel_id=xiaoetong`（需 `X-Admin-Key`）

本地：`http://127.0.0.1:8787/admin/`

---

## 四、日常操作

### 给用户发激活码（或用管理后台）

```bash
cd /opt/cat-catch-server/server
npm run license:create -- --channel xiaoetong --email 客户邮箱 --max-devices 2 --expires 2027-06-01
```

或通过 HTTP（需 `X-Admin-Key`）：

```bash
curl -X POST https://api.yourdomain.com/api/admin/licenses \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: $ADMIN_API_KEY" \
  -d '{"channel_id":"xiaoetong","email":"a@b.com","max_devices":2,"expires_at":"2027-01-01"}'
```

### 发布新版本

1. 本地 `npm run build -- xiaoetong`，打 zip，版本号与 `manifest.json` 一致（如 `2.7.0`）  
2. 上传：`server/data/releases/xiaoetong/xiaoetong-2.7.0.zip`  
3. 登记：

```bash
npm run release:create -- --channel xiaoetong --version 2.7.0 --file xiaoetong-2.7.0.zip --notes "修复xxx"
```

已激活且版本低于 2.7.0 的用户，扩展 popup 会出现下载链接。

### 备份

```bash
tar czf backup-$(date +%F).tar.gz data/licenses.db data/releases/
```

---

## 五、API 摘要（扩展用）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/activate` | 激活码 + channel_id + installation_id |
| POST | `/api/v1/check` | 校验订阅 + 返回 `update_available`、`download_url` |
| GET | `/api/v1/download?...` | 下载 zip（需有效激活） |

---

## 六、GPL 与合规提醒

- 每次发布 zip 时，在客户下载页或邮件中同时提供 **同版本 GPL 源码** 链接（公开 Git tag）。  
- 激活与下载链接属于**商业服务**；不得通过技术手段否定用户依法获得源码的权利。  
- 收集邮箱/设备 ID 需有隐私政策（见 `docs/PRIVACY.md`）。  
- 非法律意见；经营合规请咨询律师。
