/**
 * Guide 视频源配置（改完刷新 /guide/ 即可）
 *
 * 推荐：阿里云 OSS + CDN 直链填到 cdnUrl（国内播放快）
 * 可选：bilibiliBvid 作为备用；都空则提示看文字说明
 *
 * 上传步骤见 docs/GUIDE-VIDEO-OSS.md
 */
window.GUIDE_VIDEO_CONFIG = {
  title: "小鹅通扩展：嗅探与下载操作演示",

  /**
   * 阿里云 CDN / OSS 公网直链，例如：
   * "https://cdn.example.com/guide/xet-video-catch-web.mp4"
   * 上传前请先用 scripts/compress-guide-video.sh 压到约 5–12MB
   */
  cdnUrl: "",

  /** B 站 BV 号（已下架可留空） */
  bilibiliBvid: "",
};
