"""
ffmpeg_utils.py - FFmpegを使った動画生成処理
エフェクトなし・シンプル版（VPS負荷対策）
"""

import random
import logging
import subprocess
import zipfile
import csv
from pathlib import Path
from datetime import datetime
from mutagen.mp3 import MP3
from PIL import Image, ImageDraw, ImageFilter

log = logging.getLogger(__name__)


def get_mp3_duration(mp3_path):
    try:
        return MP3(mp3_path).info.length
    except Exception as e:
        log.warning(f"Duration取得失敗: {mp3_path} - {e}")
        return 0


def seconds_to_timestamp(seconds):
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    return f"{h}:{m:02d}:{s:02d}" if h > 0 else f"{m:02d}:{s:02d}"


def run_ffmpeg(cmd):
    """ffmpegをUnicode対応で実行"""
    result = subprocess.run(cmd, capture_output=True)
    stderr = result.stderr.decode("utf-8", errors="replace")
    return result.returncode, stderr


def select_background(genre, images_dir, videos_dir):
    video_ext = {".mp4", ".mov", ".avi", ".mkv"}
    image_ext = {".jpg", ".jpeg", ".png", ".webp"}

    def get_files(folder, exts):
        p = Path(folder)
        return [f for f in p.iterdir() if f.suffix.lower() in exts] if p.exists() else []

    genre_videos = get_files(Path(videos_dir) / genre, video_ext)
    other_videos = get_files(Path(videos_dir) / "other", video_ext)
    genre_images = get_files(Path(images_dir) / genre, image_ext)
    other_images = get_files(Path(images_dir) / "other", image_ext)

    all_videos = genre_videos or other_videos
    all_images = genre_images or other_images

    if all_videos and all_images:
        use_video = random.random() < 0.5
    elif all_videos:
        use_video = True
    elif all_images:
        use_video = False
    else:
        return None, None

    if use_video:
        return random.choice(genre_videos if genre_videos else other_videos), "video"
    else:
        return random.choice(genre_images if genre_images else other_images), "image"


GENRE_COLORS = {
    "healing": {"top": (5, 15, 45),  "mid": (20, 60, 100), "bottom": (10, 30, 70),  "nebula": (40, 100, 160)},
    "lofi":    {"top": (15, 5, 35),  "mid": (50, 15, 70),  "bottom": (25, 10, 55),  "nebula": (80, 40, 120)},
    "study":   {"top": (3, 10, 35),  "mid": (10, 30, 70),  "bottom": (5, 20, 55),   "nebula": (20, 60, 120)},
}
DEFAULT_GENRE = {"top": (5, 5, 25), "mid": (20, 20, 60), "bottom": (10, 10, 40), "nebula": (40, 40, 100)}


def generate_starfield_image(genre, output_path, width=1920, height=1080):
    colors = GENRE_COLORS.get(genre, DEFAULT_GENRE)
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)

    for y in range(height):
        if y < height // 2:
            ratio = y / (height // 2)
            c1, c2 = colors["top"], colors["mid"]
        else:
            ratio = (y - height // 2) / (height // 2)
            c1, c2 = colors["mid"], colors["bottom"]
        r = int(c1[0] + (c2[0] - c1[0]) * ratio)
        g = int(c1[1] + (c2[1] - c1[1]) * ratio)
        b = int(c1[2] + (c2[2] - c1[2]) * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))

    nebula_layer = Image.new("RGB", (width, height), (0, 0, 0))
    nebula_draw = ImageDraw.Draw(nebula_layer)
    rng = random.Random(123)
    nc = colors["nebula"]
    for _ in range(5):
        cx = rng.randint(width // 6, width * 5 // 6)
        cy = rng.randint(height // 8, height * 2 // 3)
        for radius in range(200, 0, -10):
            alpha = int(18 * (1 - radius / 200))
            col = (min(255, nc[0] * alpha // 10),
                   min(255, nc[1] * alpha // 10),
                   min(255, nc[2] * alpha // 10))
            nebula_draw.ellipse([cx - radius, cy - radius * 2 // 3,
                                 cx + radius, cy + radius * 2 // 3], fill=col)
    nebula_blurred = nebula_layer.filter(ImageFilter.GaussianBlur(radius=30))
    img = Image.blend(img, nebula_blurred, alpha=0.6)
    draw = ImageDraw.Draw(img)

    rng2 = random.Random(42)
    for _ in range(600):
        x = rng2.randint(0, width - 1)
        y = rng2.randint(0, height - 1)
        size = rng2.choices([0, 0, 1, 2], weights=[40, 35, 20, 5])[0]
        brightness = rng2.randint(140, 255)
        color = (brightness, brightness, min(255, brightness + 20))
        if size == 0:
            draw.point((x, y), fill=color)
        else:
            draw.ellipse([x - size, y - size, x + size, y + size], fill=color)

    for _ in range(15):
        x = rng2.randint(50, width - 50)
        y = rng2.randint(50, height - 50)
        brightness = rng2.randint(200, 255)
        color = (brightness, brightness, 255)
        draw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=color)
        for length in range(12, 0, -2):
            alpha = brightness * length // 12
            lc = (alpha, alpha, min(255, alpha + 30))
            draw.line([(x - length, y), (x + length, y)], fill=lc)
            draw.line([(x, y - length // 2), (x, y + length // 2)], fill=lc)

    img.save(str(output_path), "PNG", quality=95)
    log.info(f"星空背景を自動生成: {output_path}")
    return output_path


def concat_mp3s(mp3_files, output_path):
    list_file = Path(output_path).parent / "mp3_list.txt"
    with open(list_file, "w", encoding="utf-8") as f:
        for mp3 in mp3_files:
            f.write(f"file '{str(mp3).replace(chr(92), '/')}'\n")
    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
           "-i", str(list_file), "-c", "copy", str(output_path)]
    returncode, stderr = run_ffmpeg(cmd)
    list_file.unlink(missing_ok=True)
    if returncode != 0:
        log.error(f"mp3結合エラー: {stderr}")
        return False
    return True


def create_video_from_image(image_path, audio_path, output_path, duration, cfg):
    """静止画→動画（エフェクトなし・シンプル）"""
    w, h = cfg["width"], cfg["height"]
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
    )
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-i", str(image_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-map", "0:v", "-map", "1:a",
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path)
    ]
    returncode, stderr = run_ffmpeg(cmd)
    if returncode != 0:
        log.error(f"動画生成エラー（静止画）: {stderr[-500:]}")
        return False
    return True


def create_video_from_video(bg_video_path, audio_path, output_path, duration, cfg):
    """動画背景ループ（エフェクトなし・シンプル）"""
    w, h = cfg["width"], cfg["height"]
    vf = (
        f"scale={w}:{h}:force_original_aspect_ratio=decrease,"
        f"pad={w}:{h}:(ow-iw)/2:(oh-ih)/2"
    )
    cmd = [
        "ffmpeg", "-y",
        "-stream_loop", "-1", "-i", str(bg_video_path),
        "-i", str(audio_path),
        "-vf", vf,
        "-map", "0:v", "-map", "1:a",
        "-t", str(duration),
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "192k",
        str(output_path)
    ]
    returncode, stderr = run_ffmpeg(cmd)
    if returncode != 0:
        log.error(f"動画生成エラー（動画背景）: {stderr[-500:]}")
        return False
    return True


def create_video_black_bg(audio_path, output_path, duration, cfg):
    """背景素材なし → 星空自動生成して動画生成"""
    tmp_img = Path(output_path).parent / f"_starfield_{Path(output_path).stem}.png"
    genre = Path(output_path).stem.split("_")[0]
    generate_starfield_image(genre, tmp_img, cfg["width"], cfg["height"])
    success = create_video_from_image(tmp_img, audio_path, output_path, duration, cfg)
    tmp_img.unlink(missing_ok=True)
    return success


def archive_used_mp3s(mp3_files, archive_dir, label, tracklist, video_filename):
    archive_dir = Path(archive_dir)
    archive_dir.mkdir(exist_ok=True)

    date_str = datetime.now().strftime("%Y%m%d")
    zip_path = archive_dir / f"used_{label}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.zip"
    title_map = {i: item["title"] for i, item in enumerate(tracklist)}

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, mp3 in enumerate(mp3_files):
            title = title_map.get(i, Path(mp3).stem)
            safe_title = "".join(c for c in title if c not in r'\/:*?"<>|')
            new_name = f"{date_str}_{label}_{safe_title}.mp3"
            zf.write(mp3, new_name)

    for mp3 in mp3_files:
        Path(mp3).unlink()

    log.info(f"アーカイブ完了: {zip_path}")

    csv_path = archive_dir / "history.csv"
    file_exists = csv_path.exists()
    with open(csv_path, "a", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        if not file_exists:
            writer.writerow(["日付", "ジャンル", "動画ファイル名", "タイムスタンプ", "曲タイトル", "元ファイル名"])
        for mp3, track in zip(mp3_files, tracklist):
            writer.writerow([
                date_str,
                label.split("_")[0],
                video_filename,
                track["timestamp"],
                track["title"],
                Path(mp3).name,
            ])

    log.info(f"履歴記録: {csv_path}")
