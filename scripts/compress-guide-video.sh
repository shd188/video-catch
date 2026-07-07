#!/usr/bin/env bash
# 将 guide 演示视频压缩为 Web 播放版（需本机安装 ffmpeg）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/asset/xet-video-catch.mp4}"
OUT="${2:-$ROOT/server/public/guide/xet-video-catch-web.mp4}"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "请先安装 ffmpeg，例如: brew install ffmpeg" >&2
  exit 1
fi

if [[ ! -f "$SRC" ]]; then
  echo "源文件不存在: $SRC" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUT")"

echo "压缩: $SRC"
echo "输出: $OUT"

ffmpeg -y -i "$SRC" \
  -c:v libx264 -preset slow -crf 28 \
  -vf "scale='min(1280,iw)':-2" \
  -c:a aac -b:a 96k \
  -movflags +faststart \
  "$OUT"

echo ""
ls -lh "$SRC" "$OUT"
echo "完成。将 xet-video-catch-web.mp4 提交并部署后，guide 页会自动优先使用该文件。"
