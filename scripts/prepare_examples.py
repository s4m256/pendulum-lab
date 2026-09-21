"""Reproduce the bundled real-video excerpts and image measurements.
Run from repository root. Downloads about 1.3 GB into .cache/iris (ignored).
Dependencies: python -m pip install -r scripts/requirements.txt
Then: python scripts/prepare_examples.py && node scripts/fit-examples.ts
"""
import hashlib
import json
from pathlib import Path
import subprocess
import urllib.request
import cv2
import imageio_ffmpeg
import numpy as np

REVISION = 'c253822f55431ca80ef2084de4bc5e79d1a488f1'
ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache' / 'iris'
OUT = ROOT / 'public' / 'examples'
CACHE.mkdir(parents=True, exist_ok=True)

def sha(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()

for label in ['45', '20']:
    manifest_path = OUT / f'pendulum-{label}.json'
    manifest = json.loads(manifest_path.read_text())
    source = CACHE / f'pendulum-{label}.mp4'
    if not source.exists():
        url = f'https://huggingface.co/datasets/rasulkhanbayov/IRIS/resolve/{REVISION}/Pendulum/pendulum_{label}/01.mp4'
        print('Downloading', url, flush=True)
        urllib.request.urlretrieve(url, source)
    if sha(source) != manifest['sourceSha256']:
        raise ValueError('Source hash mismatch: ' + str(source))
    clip = OUT / f'pendulum-{label}.mp4'
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-ss', '0.5', '-i', str(source), '-t', '14', '-vf', 'scale=960:540,fps=30', '-pix_fmt', 'yuv420p', '-an', '-c:v', 'libx264', '-crf', '22', '-preset', 'fast', '-movflags', '+faststart', str(clip)], check=True)
    capture = cv2.VideoCapture(str(clip))
    points = []
    while True:
        ok, frame = capture.read()
        if not ok:
            break
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        mask = cv2.inRange(hsv, np.array([22, 65, 45]), np.array([48, 255, 255]))
        n, _, stats, centers = cv2.connectedComponentsWithStats(mask)
        valid = [i for i in range(1, n) if stats[i, 4] > 80 and centers[i, 1] > 100]
        if not valid:
            raise ValueError(f'No bob in {label}, frame {len(points)}')
        i = max(valid, key=lambda i: stats[i, 4])
        x, y = centers[i]
        points.append(dict(t=len(points) / 30, x=round(float(x), 3), y=round(float(y), 3), confidence=1))
        if len(points) == 1:
            cv2.imwrite(str(OUT / f'pendulum-{label}.jpg'), frame)
    capture.release()
    xy = np.array([[p['x'], p['y']] for p in points[:int(len(points) * .75)]])
    cx, cy, k = np.linalg.lstsq(np.c_[2 * xy, np.ones(len(xy))], (xy ** 2).sum(axis=1), rcond=None)[0]
    manifest.update(points=points, pivot=dict(x=float(cx), y=float(cy)), radius=float(np.sqrt(k+cx*cx+cy*cy)), clipSha256=sha(clip), sourceRevision=REVISION)
    manifest.pop('analysis', None)
    manifest_path.write_text(json.dumps(manifest, separators=(',', ':')))
    print(label, 'frames:', len(points), 'Run node scripts/fit-examples.ts next.')
