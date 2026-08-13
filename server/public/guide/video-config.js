/**
 * Guide 视频源配置（改完刷新 /guide/ 即可）
 *
 * 推荐：阿里云 OSS + CDN 直链填到 cdnUrl（国内播放快）
 * 可选：bilibiliBvid 作为备用；都空则提示看文字说明
 *
 * 上传步骤见 docs/GUIDE-VIDEO-OSS.md
 */
window.GUIDE_VIDEO_CONFIG = {
  title: "安装与使用演示",

  /** 阿里云 OSS 公共读直链 */
  cdnUrl: "https://downloadtool.oss-cn-beijing.aliyuncs.com/guide-web.mp4",

  /** B 站 BV 号（已下架可留空） */
  bilibiliBvid: "",
};
