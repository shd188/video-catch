# 下一步行动清单（按顺序做）

## 阶段 A：仓库与合规（1 天）

1. [ ] 推送代码到 https://github.com/shd188/vidio-catch（见 [DEPLOY-ALIYUN.md](./DEPLOY-ALIYUN.md) 第 1 步）  
2. [x] `channels/xiaoetong/channel.json` 已指向该仓库与 `https://api.heidilabs.cn`（部署前请确认 DNS/HTTPS 已通）  
3. [ ] 填写 `docs/SERVICE.md`、`docs/PRIVACY.md` 中的联系方式  
4. [ ] 请律师审阅用户协议要点：仅用于已授权内容、GPL 权利、退款（可参考 `docs/COMPLIANCE.md`）

## 阶段 B：服务器（半天）

1. [ ] 购买 VPS（1 核 1G 即可）+ 域名子域 `api.xxx.com`  
2. [ ] 按 [DEPLOY-ALIYUN.md](./DEPLOY-ALIYUN.md) 部署阿里云 + `api.heidilabs.cn`  
3. [ ] `curl https://api.heidilabs.cn/health` 返回 ok  
4. [ ] 本机 `npm run build -- xiaoetong` 后分发 `dist/xiaoetong`  
5. [ ] `npm run build -- xiaoetong`，侧载测试安装页激活流程  

## 阶段 C：发码与发版（持续）

1. [ ] 客户付款后：`npm run license:create -- --channel xiaoetong --email ...`  
2. [ ] 把激活码发给客户；客户在安装页或后续设置中输入  
3. [ ] 每次发版：构建 zip → 上传到 `server/data/releases/xiaoetong/` → `release:create`  
4. [ ] 邮件/群内通知客户；已激活用户扩展内会出现「新版本下载」  

## 阶段 D：多渠道（按需）

1. [ ] 复制 `channels/_template` → `channels/新渠道/`  
2. [ ] `npm run build -- 新渠道` → 独立 zip  
3. [ ] 后台 `license:create --channel 新渠道`  

## 本地常用命令

```bash
# 扩展
npm run build -- xiaoetong

# 后台
cd server && npm run dev
npm run license:create -- --channel xiaoetong --email test@test.com
```
