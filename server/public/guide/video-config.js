/**
 * Guide 视频源配置（修改后刷新 /guide/ 即可，无需改 index.html）
 *
 * 加速建议（按效果排序）：
 * 1. bilibiliBvid — 上传 B 站后填 BV 号，国内播放最快
 * 2. cdnUrl — 阿里云 OSS / 又拍云等 CDN 直链
 * 3. webMp4 — 运行 scripts/compress-guide-video.sh 生成的小体积版本
 * 4. fallbackMp4 — 原片（约 35MB，香港服务器直连较慢）
 */
window.GUIDE_VIDEO_CONFIG = {
  title: "小鹅通扩展：嗅探与下载操作演示",

  /** B 站 BV 号，例如 "BV1xx411c7mD"（留空则不显示 B 站入口） */
  bilibiliBvid: "BV1MHMa6oE4F",

  /** CDN / OSS 直链（留空则不显示） */
  cdnUrl: "",

  /** 压缩版 MP4（scripts/compress-guide-video.sh 生成，约 8–15MB） */
  webMp4: "/guide/xet-video-catch-web.mp4",

  /** 原片备用 */
  fallbackMp4: "/guide/xet-video-catch.mp4",

  /** 显示给用户的体积提示（MB，仅文案） */
  webSizeMb: 12,
  fallbackSizeMb: 35,
};
