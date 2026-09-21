export type Model = "linear" | "nonlinear" | "damped";
export type Point = { t: number; x: number; y: number; confidence: number };
export type Observation = { t: number; angle: number };
// q = g/L (or mgd/I for a physical pendulum), beta in theta'' + beta theta' + q sin(theta) = 0.
export type Params = {
  q: number;
  beta: number;
  angle: number;
  velocity: number;
  offset: number;
};
export type Fit = {
  model: Model;
  params: Params;
  prediction: number[];
  residuals: number[];
  trainRmse: number;
  testRmse: number;
  aicc: number;
  intervals: Record<string, [number, number]>;
  bootstrapSuccess: number;
  warnings: string[];
  correlation: number;
};
export type Analysis = {
  observations: Observation[];
  split: number;
  fits: Fit[];
  best: Model;
  bootstrapReplicates: number;
};
export const models: Model[] = ["linear", "nonlinear", "damped"];
export const labels: Record<Model, string> = {
  linear: "Small-angle",
  nonlinear: "Nonlinear",
  damped: "Damped nonlinear",
};
export const equations: Record<Model, string> = {
  linear: "θ̈ + qθ = 0",
  nonlinear: "θ̈ + q sin θ = 0",
  damped: "θ̈ + βθ̇ + q sin θ = 0",
};
export function simulate(
  times: number[],
  p: Params,
  model: Model,
  maxStep = 1 / 120,
): number[] {
  let a = p.angle,
    v = p.velocity,
    t = 0;
  const out: number[] = [];
  const acc = (x: number, u: number) =>
    -p.q * (model === "linear" ? x : Math.sin(x)) -
    (model === "damped" ? p.beta * u : 0);
  for (const target of times) {
    while (t < target - 1e-10) {
      const h = Math.min(maxStep, target - t),
        k1 = v,
        l1 = acc(a, v),
        k2 = v + (h * l1) / 2,
        l2 = acc(a + (h * k1) / 2, v + (h * l1) / 2),
        k3 = v + (h * l2) / 2,
        l3 = acc(a + (h * k2) / 2, v + (h * l2) / 2),
        k4 = v + h * l3,
        l4 = acc(a + h * k3, v + h * l3);
      a += (h * (k1 + 2 * k2 + 2 * k3 + k4)) / 6;
      v += (h * (l1 + 2 * l2 + 2 * l3 + l4)) / 6;
      t += h;
    }
    out.push(a + p.offset);
  }
  return out;
}
export function solve(A: number[][], b: number[]): number[] | null {
  const m = A.map((r, i) => [...r, b[i]]),
    n = b.length;
  for (let i = 0; i < n; i++) {
    let pivot = i;
    for (let j = i + 1; j < n; j++)
      if (Math.abs(m[j][i]) > Math.abs(m[pivot][i])) pivot = j;
    if (Math.abs(m[pivot][i]) < 1e-12) return null;
    [m[i], m[pivot]] = [m[pivot], m[i]];
    const d = m[i][i];
    for (let k = i; k <= n; k++) m[i][k] /= d;
    for (let j = 0; j < n; j++)
      if (j !== i) {
        const f = m[j][i];
        for (let k = i; k <= n; k++) m[j][k] -= f * m[i][k];
      }
  }
  return m.map((r) => r[n]);
}
const keys = (model: Model): (keyof Params)[] =>
  model === "damped"
    ? ["q", "beta", "angle", "velocity", "offset"]
    : ["q", "angle", "velocity", "offset"];
const clamp = (p: Params): Params => ({
  q: Math.max(0.04, Math.min(400, p.q)),
  beta: Math.max(0, Math.min(4, p.beta)),
  angle: Math.max(-3, Math.min(3, p.angle)),
  velocity: Math.max(-30, Math.min(30, p.velocity)),
  offset: Math.max(-0.35, Math.min(0.35, p.offset)),
});
const mse = (a: number[], b: number[]) =>
  a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length;
export function initial(data: Observation[]): Params {
  const ts = data.map((d) => d.t),
    ys = data.map((d) => d.angle);
  let best = Infinity,
    p: Params = { q: 10, beta: 0, angle: ys[0], velocity: 0, offset: 0 };
  // A frequency scan avoids locking onto a local phase minimum.
  for (let w = 0.4; w <= 18; w += 0.025) {
    const rows = ts.map((t) => [Math.cos(w * t), Math.sin(w * t), 1]);
    const A = [0, 1, 2].map((i) =>
      [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)),
    );
    const b = [0, 1, 2].map((i) =>
      rows.reduce((s, r, k) => s + r[i] * ys[k], 0),
    );
    const c = solve(A, b);
    if (!c) continue;
    const error = mse(
      ys,
      rows.map((r) => r.reduce((s, v, j) => s + v * c[j], 0)),
    );
    if (error < best) {
      best = error;
      p = { q: w * w, beta: 0, angle: c[0], velocity: c[1] * w, offset: c[2] };
    }
  }
  return clamp(p);
}
export function optimize(
  data: Observation[],
  model: Model,
  seed: Params,
  iterations = 65,
): Params {
  const ts = data.map((d) => d.t),
    ys = data.map((d) => d.angle),
    active = keys(model);
  let p = clamp({ ...seed, beta: model === "damped" ? seed.beta : 0 }),
    lambda = 0.001;
  let pred = simulate(ts, p, model),
    error = mse(pred, ys);
  for (let it = 0; it < iterations; it++) {
    const J = active.map((k) => {
      const h = 1e-5 * Math.max(1, Math.abs(p[k]));
      const pp = { ...p, [k]: p[k] + h };
      const shifted = simulate(ts, pp, model);
      return shifted.map((v, i) => (v - pred[i]) / h);
    });
    const A = active.map((_, j) =>
      active.map((_, k) => J[j].reduce((s, v, i) => s + v * J[k][i], 0)),
    );
    const b = active.map((_, j) =>
      J[j].reduce((s, v, i) => s + v * (ys[i] - pred[i]), 0),
    );
    A.forEach((r, j) => (r[j] += lambda * Math.max(r[j], 1e-6)));
    const d = solve(A, b);
    if (!d) break;
    const next = clamp({ ...p });
    active.forEach((k, j) => (next[k] += d[j]));
    const bounded = clamp(next),
      trial = simulate(ts, bounded, model),
      e = mse(trial, ys);
    if (e < error) {
      const change = error - e;
      p = bounded;
      pred = trial;
      error = e;
      lambda = Math.max(1e-9, lambda / 3);
      if (change < 1e-12) break;
    } else {
      lambda *= 8;
      if (lambda > 1e10) break;
    }
  }
  return p;
}
export function observations(
  points: Point[],
  pivot: { x: number; y: number },
): Observation[] {
  if (points.length < 30)
    throw new Error("At least 30 reliably tracked frames are needed.");
  const t0 = points[0].t;
  return points.map((p) => ({
    t: p.t - t0,
    angle: Math.atan2(p.x - pivot.x, p.y - pivot.y),
  }));
}
export function validate(data: Observation[]) {
  if (data.length < 40)
    throw new Error("Too few measurements. Track at least 40 frames.");
  if (
    data.some(
      (d, i) =>
        !Number.isFinite(d.t) ||
        !Number.isFinite(d.angle) ||
        (i > 0 && d.t <= data[i - 1].t),
    )
  )
    throw new Error("Measurements must be finite and ordered in time.");
  if (Math.abs(data[0].t) > 1e-8)
    throw new Error("Measurements must start at time zero.");
  if (data.at(-1)!.t < 2)
    throw new Error("Use at least two seconds of free oscillation.");
  if (
    Math.max(...data.map((d) => d.angle)) -
      Math.min(...data.map((d) => d.angle)) <
    0.06
  )
    throw new Error("Too little motion to identify the dynamics.");
}
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const quantile = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y),
    i = (s.length - 1) * p;
  return s[Math.floor(i)] + (s[Math.ceil(i)] - s[Math.floor(i)]) * (i % 1);
};
export function analyze(
  data: Observation[],
  replicates = 60,
  progress?: (s: string) => void,
): Analysis {
  validate(data);
  const split = Math.floor(data.length * 0.75),
    train = data.slice(0, split),
    times = data.map((d) => d.t),
    ys = data.map((d) => d.angle),
    seed = initial(train),
    random = rng(6174);
  const fits: Fit[] = models.map((model) => {
    progress?.(`Fitting ${labels[model].toLowerCase()}…`);
    const amp = Math.hypot(seed.angle, seed.velocity / Math.sqrt(seed.q));
    const starts = [
      {
        ...seed,
        q: seed.q * (model === "linear" ? 1 : 1 + (amp * amp) / 8),
        beta: 0.02,
      },
      { ...seed, beta: 0.08 },
    ];
    const candidates = starts.map((p) => optimize(train, model, p));
    candidates.sort(
      (a, b) =>
        mse(
          simulate(
            train.map((d) => d.t),
            a,
            model,
          ),
          train.map((d) => d.angle),
        ) -
        mse(
          simulate(
            train.map((d) => d.t),
            b,
            model,
          ),
          train.map((d) => d.angle),
        ),
    );
    const p = candidates[0],
      prediction = simulate(times, p, model),
      residuals = ys.map((v, i) => v - prediction[i]),
      tr = residuals.slice(0, split),
      n = tr.length,
      k = keys(model).length + 1;
    const rss = tr.reduce((s, v) => s + v * v, 0),
      trainRmse = Math.sqrt(rss / n),
      testRmse = Math.sqrt(
        residuals.slice(split).reduce((s, v) => s + v * v, 0) /
          (data.length - split),
      );
    const aicc =
      n * Math.log(Math.max(1e-20, rss / n)) +
      2 * k +
      (2 * k * (k + 1)) / (n - k - 1);
    const mean = tr.reduce((a, b) => a + b, 0) / n,
      centered = tr.map((v) => v - mean),
      block = Math.max(4, Math.round(Math.sqrt(n))),
      samples: Params[] = [];
    for (let r = 0; r < replicates; r++) {
      const noise: number[] = [];
      while (noise.length < n) {
        const start = Math.floor(random() * n);
        for (let b = 0; b < block && noise.length < n; b++)
          noise.push(centered[(start + b) % n]);
      }
      const boot = train.map((d, i) => ({
        t: d.t,
        angle: prediction[i] + noise[i],
      }));
      const bp = optimize(boot, model, p, 28);
      if (Object.values(bp).every(Number.isFinite)) samples.push(bp);
    }
    const intervals: Record<string, [number, number]> = {};
    for (const key of keys(model))
      if (samples.length >= 20)
        intervals[key] = [
          quantile(
            samples.map((p) => p[key]),
            0.025,
          ),
          quantile(
            samples.map((p) => p[key]),
            0.975,
          ),
        ];
    const correlation =
      centered.slice(1).reduce((s, v, i) => s + v * centered[i], 0) /
      Math.max(
        1e-20,
        centered.reduce((s, v) => s + v * v, 0),
      );
    const warnings: string[] = [];
    if (Math.abs(correlation) > 0.5)
      warnings.push(
        "Residuals are correlated: tracking error or missing physics remains. Bootstrap intervals are conditional, not total measurement uncertainty.",
      );
    if (
      model === "damped" &&
      (p.beta < 1e-4 || (intervals.beta?.[0] ?? 1) < 1e-4)
    )
      warnings.push(
        "Damping reaches the zero boundary; this clip may not resolve nonzero damping.",
      );
    if ((train.at(-1)!.t * Math.sqrt(p.q)) / (2 * Math.PI) < 2)
      warnings.push(
        "Fewer than two training cycles: parameter estimates are weakly constrained.",
      );
    if (Math.abs(p.offset) > 0.34 || p.q < 0.041 || p.q > 399 || p.beta > 3.99)
      warnings.push(
        "A parameter reached its allowed range. Do not interpret this fit quantitatively.",
      );
    return {
      model,
      params: p,
      prediction,
      residuals,
      trainRmse,
      testRmse,
      aicc,
      intervals,
      bootstrapSuccess: samples.length,
      warnings,
      correlation,
    };
  });
  // Choose by training AICc only. The last quarter is an untouched extrapolation check.
  const best = [...fits].sort((a, b) => a.aicc - b.aicc)[0].model;
  return {
    observations: data,
    split,
    fits,
    best,
    bootstrapReplicates: replicates,
  };
}
export function calibrate(
  q: number,
  interval: [number, number] | undefined,
  kind: "none" | "length" | "gravity",
  value: number,
  uncertainty = 0,
) {
  if (kind === "none") return null;
  if (
    !Number.isFinite(value) ||
    value <= 0 ||
    !Number.isFinite(uncertainty) ||
    uncertainty < 0 ||
    uncertainty >= value
  )
    throw new Error(
      "Calibration must be positive, with uncertainty smaller than its value.",
    );
  const result = kind === "length" ? q * value : value / q;
  const bounds = interval
    ? kind === "length"
      ? [
          interval[0] * (value - uncertainty),
          interval[1] * (value + uncertainty),
        ]
      : [
          (value - uncertainty) / interval[1],
          (value + uncertainty) / interval[0],
        ]
    : undefined;
  return {
    quantity: kind === "length" ? "g" : "L",
    value: result,
    bounds,
    unit: kind === "length" ? "m/s²" : "m",
  };
}
