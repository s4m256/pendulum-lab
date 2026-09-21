import type { Point } from "./physics";
export type Position = { x: number; y: number };
export type Template = { pixels: Float32Array; radius: number; energy: number };
const luminance = (data: Uint8ClampedArray, i: number) =>
  data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
export function templateAt(
  image: ImageData,
  p: Position,
  radius = 9,
): Template {
  const pixels: number[] = [];
  for (let y = -radius; y <= radius; y++)
    for (let x = -radius; x <= radius; x++) {
      const px = Math.max(0, Math.min(image.width - 1, Math.round(p.x) + x)),
        py = Math.max(0, Math.min(image.height - 1, Math.round(p.y) + y));
      pixels.push(luminance(image.data, 4 * (py * image.width + px)));
    }
  const mean = pixels.reduce((a, b) => a + b) / pixels.length,
    centered = Float32Array.from(pixels.map((x) => x - mean));
  const energy = Math.sqrt(centered.reduce((s, v) => s + v * v, 0));
  if (energy < 30)
    throw new Error(
      "Select a bob with a visible edge or textured marker. This patch has too little contrast.",
    );
  return { pixels: centered, radius, energy };
}
export function match(
  image: ImageData,
  template: Template,
  previous: Position,
  pivot: Position,
  length: number,
  search = 65,
): { point: Position; confidence: number } {
  const { width, height, data } = image,
    { radius: r, pixels, energy } = template,
    n = pixels.length;
  let best = -1,
    point = { ...previous };
  // Search over the image, constrained only by geometry and frame-to-frame proximity; no fitted ODE is used.
  const score = (x: number, y: number) => {
    if (
      x < r ||
      y < r ||
      x >= width - r ||
      y >= height - r ||
      Math.abs(Math.hypot(x - pivot.x, y - pivot.y) - length) >
        Math.max(15, length * 0.16)
    )
      return -1;
    let sum = 0,
      sq = 0,
      dot = 0,
      k = 0;
    for (let j = -r; j <= r; j++)
      for (let i = -r; i <= r; i++) {
        const v = luminance(data, 4 * ((y + j) * width + x + i));
        sum += v;
        sq += v * v;
        dot += v * pixels[k++];
      }
    return dot / (energy * Math.sqrt(Math.max(1, sq - (sum * sum) / n)));
  };
  for (
    let y = Math.max(r, Math.round(previous.y - search));
    y < Math.min(height - r, previous.y + search);
    y += 3
  )
    for (
      let x = Math.max(r, Math.round(previous.x - search));
      x < Math.min(width - r, previous.x + search);
      x += 3
    ) {
      const s = score(x, y);
      if (s > best) {
        best = s;
        point = { x, y };
      }
    }
  const coarse = { ...point };
  for (let y = coarse.y - 3; y <= coarse.y + 3; y++)
    for (let x = coarse.x - 3; x <= coarse.x + 3; x++) {
      const s = score(x, y);
      if (s > best) {
        best = s;
        point = { x, y };
      }
    }
  return { point, confidence: best };
}
export function seek(video: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - t) < 0.0001 && video.readyState >= 2) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("Video decoding timed out. Try an H.264 MP4."));
    }, 8000);
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener("seeked", done);
      video.removeEventListener("error", fail);
    };
    const done = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new Error("This video could not be decoded."));
    };
    video.addEventListener("seeked", done, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.currentTime = t;
  });
}
export async function track(
  video: HTMLVideoElement,
  pivot: Position,
  bob: Position,
  start: number,
  end: number,
  progress: (p: number) => void,
  signal: AbortSignal,
): Promise<Point[]> {
  const canvas = document.createElement("canvas");
  canvas.width = 960;
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * 960);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const grab = () => {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  };
  await seek(video, start);
  const first = grab(),
    template = templateAt(first, bob),
    color = colorAt(first, bob),
    length = Math.hypot(bob.x - pivot.x, bob.y - pivot.y),
    points: Point[] = [];
  let previous = bob,
    misses = 0;
  const rate = 30,
    count = Math.floor((end - start) * rate);
  for (let i = 0; i <= count; i++) {
    if (signal.aborted)
      throw new DOMException("Tracking cancelled", "AbortError");
    const t = start + i / rate;
    await seek(video, Math.min(video.duration - 0.001, t + 0.001));
    const result =
      i === 0
        ? { point: bob, confidence: 1 }
        : color
          ? colorMatch(grab(), color, previous, pivot, length)
          : match(grab(), template, previous, pivot, length);
    if (result.confidence < 0.5) {
      misses++;
      if (misses > 3)
        throw new Error(
          `Lost the bob at ${t.toFixed(2)} s. Shorten the clip, choose a clearer marker, or use manual correction.`,
        );
    } else {
      misses = 0;
      previous = result.point;
      points.push({ t, ...result.point, confidence: result.confidence });
    }
    if (i % 4 === 0) {
      progress(i / count);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  if (points.length < count * 0.85)
    throw new Error(
      "Too many unreliable frames. Try a higher-contrast bob and a stationary camera.",
    );
  return points;
}
// Connected-component color tracking: a fixed chromaticity reference from the selected bob.
export type ColorReference = { r: number; g: number; b: number };
export function colorAt(image: ImageData, p: Position): ColorReference | null {
  let r = 0,
    g = 0,
    b = 0,
    n = 0;
  for (let y = -3; y <= 3; y++)
    for (let x = -3; x <= 3; x++) {
      const i =
        4 *
        (Math.max(0, Math.min(image.height - 1, Math.round(p.y) + y)) *
          image.width +
          Math.max(0, Math.min(image.width - 1, Math.round(p.x) + x)));
      r += image.data[i];
      g += image.data[i + 1];
      b += image.data[i + 2];
      n++;
    }
  const total = r + g + b;
  if (
    total < 30 * n ||
    (Math.max(r, g, b) - Math.min(r, g, b)) / Math.max(r, g, b) < 0.3
  )
    return null;
  return { r: r / total, g: g / total, b: b / total };
}
export function colorMatch(
  image: ImageData,
  ref: ColorReference,
  previous: Position,
  pivot: Position,
  length: number,
): { point: Position; confidence: number } {
  const { width: w, height: h, data } = image,
    mask = new Uint8Array(w * h),
    candidates: { x: number; y: number; area: number }[] = [];
  const x0 = Math.max(0, Math.floor(previous.x - 90)),
    x1 = Math.min(w - 1, Math.ceil(previous.x + 90)),
    y0 = Math.max(0, Math.floor(previous.y - 90)),
    y1 = Math.min(h - 1, Math.ceil(previous.y + 90));
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (
        Math.abs(Math.hypot(x - pivot.x, y - pivot.y) - length) >
        Math.max(20, length * 0.15)
      )
        continue;
      const i = 4 * (y * w + x),
        r = data[i],
        g = data[i + 1],
        b = data[i + 2],
        sum = r + g + b;
      if (
        sum > 60 &&
        Math.hypot(r / sum - ref.r, g / sum - ref.g, b / sum - ref.b) < 0.14
      )
        mask[y * w + x] = 1;
    }
  const stack: number[] = [];
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      if (mask[y * w + x]) {
        let sx = 0,
          sy = 0,
          area = 0;
        stack.push(y * w + x);
        mask[y * w + x] = 0;
        while (stack.length) {
          const i = stack.pop()!,
            px = i % w,
            py = Math.floor(i / w);
          sx += px;
          sy += py;
          area++;
          for (const j of [i - 1, i + 1, i - w, i + w])
            if (j >= 0 && j < w * h && mask[j] && Math.abs((j % w) - px) <= 1) {
              mask[j] = 0;
              stack.push(j);
            }
        }
        if (area >= 12) candidates.push({ x: sx / area, y: sy / area, area });
      }
  candidates.sort((a, b) => b.area - a.area);
  const c = candidates[0];
  return c
    ? { point: { x: c.x, y: c.y }, confidence: Math.min(1, c.area / 100) }
    : { point: previous, confidence: 0 };
}
