# 商业服务说明（GPL 软件 + 付费服务）

本仓库发布的浏览器扩展遵循 **GPL-3.0**。你可以自由使用、修改和再分发源码及构建产物。

## 付费购买的是什么

付费项目**不是**「专有软件授权」，而是例如：

| 服务项 | 说明 |
|--------|------|
| 渠道适配维护 | 小鹅通等站点改版时更新白名单、正则、脚本策略 |
| 构建与交付 | 提供已测试的 `dist/<channel>/` 或 crx/zip 及版本说明 |
| 安装支持 | 侧载安装、浏览器策略、故障排查 |
| 订阅更新 | 在订阅期内提供新 tag 构建与变更日志 |

## 不包含什么

- 不承诺绕过 DRM、平台加密或违反网站服务条款的行为  
- 不承诺扩展在任意网站可用（渠道版仅启用配置中的域名白名单）  
- 不提供对 GPL 权利的限制（客户仍依法享有源码与再分发权）

## 试点：小鹅通渠道

- 渠道 ID：`xiaoetong`  
- 说明见 [channels/xiaoetong/README.md](../channels/xiaoetong/README.md)  
- 参考课程页（试点配置依据）：  
  https://appkrjfyd6q7315.h5.xiaoeknow.com/v4/course/alive/l_5b0083070ce02_VbYUCnbU?app_id=appkrjfyD6q7315&l_program=xe_know_pc  

构建：

```bash
npm run build -- xiaoetong
```

## 合规

详见 [COMPLIANCE.md](./COMPLIANCE.md)。

## 联系方式

（请运营方在此填写支持邮箱、工单链接或官网。）
