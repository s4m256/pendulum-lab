import "./style.css";
import {
  labels,
  equations,
  observations,
  calibrate,
  type Point,
  type Model,
  type Analysis,
} from "./physics";
import { track, seek, type Position } from "./tracking";
const $ = <T extends HTMLElement = HTMLElement>(s: string) =>
  document.querySelector<T>(s)!;
const asset = (s: string) => `${import.meta.env.BASE_URL}${s}`;
const repo = "https://github.com/s4m256/pendulum-lab";
$("#app").innerHTML = `
<header><a class="brand" href="./" aria-label="Pendulum Lab home"><svg viewBox="0 0 36 36"><path d="M8 6h20M18 6l11 22"/><circle cx="29" cy="28" r="5"/></svg>Pendulum<span>Lab</span></a><nav><a href="#experiment">Experiment</a><a href="#method">The method</a><a href="${repo}" target="_blank" rel="noopener">GitHub ↗</a></nav><span class="local"><i></i> Runs in your browser</span></header>
<main><section class="intro"><div><div class="eyebrow">INVERSE PHYSICS · EXPERIMENT 001</div><h1>Watch the motion.<br><em>Recover the physics.</em></h1></div><div class="intro-copy"><p>A real video. Three physical models.<br> Find the equation that survives the experiment.</p><a href="#method">From pixels to parameters <span>↘</span></a></div></section>
<section id="experiment" class="experiment"><div class="experiment-bar"><div class="tabs" role="group" aria-label="Example experiments"><button class="tab active" data-example="45">01 <span>Large-angle release</span></button><button class="tab" data-example="20">02 <span>Gentle release</span></button></div><button id="upload" class="upload">↑ &nbsp; Use your video</button><input id="file" type="file" accept="video/*" hidden></div>
<div id="status" role="status" aria-live="polite" hidden></div>
<div class="workbench"><div class="visual-side"><div class="video-head"><div><span class="dot"></span> <strong id="video-title">Large-angle release</strong></div><span id="clip-meta">REAL FOOTAGE · 30 FPS</span></div><div class="stage"><video id="video" muted playsinline preload="auto" aria-label="Pendulum experiment video"></video><canvas id="overlay" width="960" height="540" aria-label="Measured bob and fitted dynamics overlay"></canvas><div class="stage-label" id="stage-label">MEASUREMENT + RECOVERED DYNAMICS</div><div class="legend"><span class="measured">● Measured</span><span class="fitted">○ Model</span></div></div><div class="transport"><button id="play" aria-label="Play experiment">▶</button><input id="scrub" type="range" min="0" max="14" step="0.001" value="0" aria-label="Video time"><output id="time">0.00 / 14.00 s</output><button id="overlay-toggle" aria-pressed="true" title="Toggle overlay">Overlay</button></div>
<div class="plot-head"><strong>Does the model follow the motion?</strong><span>ANGLE / DEG</span></div><canvas id="angle-plot" class="plot" aria-label="Measured and modeled angle over time"></canvas><div class="plot-head residual-head"><strong>What the model misses</strong><span>RESIDUAL / DEG</span></div><canvas id="residual-plot" class="plot residual" aria-label="Angular residual over time"></canvas><div class="plot-key"><span><i></i> First 75%: fit</span><span><i class="holdout"></i> Last 25%: unseen prediction</span><span>Click a plot to seek</span></div><div class="source-line" id="source-line"></div></div>
<aside class="analysis-side"><div class="section-label">01 / COMPARE THE EXPLANATIONS</div><div class="compare-title"><h2>Which physics fits?</h2><span>Lower error is better</span></div><div id="model-cards"></div><div id="verdict" class="verdict"></div><div class="section-label parameters-label">02 / RECOVER THE PARAMETERS</div><div id="parameters"></div><div class="identifiability"><span class="info-icon">i</span><div><strong>A ratio, not two measurements.</strong><p>The video identifies q = g/L. Gravity and length cannot be recovered independently. Mass is unobservable.</p></div></div><details class="calibration"><summary>Add a physical calibration <span>+</span></summary><p>Point-mass assumption. Supply one independently measured quantity.</p><label>Known quantity<select id="cal-kind"><option value="none">No calibration</option><option value="length">Pivot-to-bob length (m)</option><option value="gravity">Assumed gravity (m/s²)</option></select></label><div class="cal-row"><label>Value<input id="cal-value" type="number" min="0.0001" step="0.01" value="1"></label><label>Absolute ± bound<input id="cal-error" type="number" min="0" step="0.001" value="0"></label></div><div id="cal-result"></div></details><details class="diagnostics"><summary>Fit diagnostics & uncertainty <span>+</span></summary><div id="diagnostics"></div></details><div class="actions"><button id="refit">↻ Refit measurements</button><button id="export">↓ Export results</button></div><button id="retrack" class="text-button">Inspect / retrack this video →</button></aside></div></section>
<section id="setup" class="setup" hidden><div><div class="eyebrow">YOUR EXPERIMENT</div><h2>Two points. Then let the physics speak.</h2><p>Use a stationary camera facing the swing plane. Choose free motion after the hand leaves, with at least 3 full cycles. A bright, solid-color bob works best. Clips stay on your device.</p></div><div class="setup-controls"><label>Start (s)<input id="start" type="number" min="0" step="0.1" value="0"></label><label>End (s), max 30 s<input id="end" type="number" min="2" step="0.1" value="12"></label><button id="select-pivot">1 · Mark pivot</button><button id="select-bob">2 · Mark bob</button><button id="track" class="primary">Track & fit →</button><button id="cancel" hidden>Cancel tracking</button><button id="correct">Correct bob at current time</button><p id="setup-help">Set the time range, mark the pivot, then mark the bob at the start time. Click directly on the video.</p></div></section>
<section id="method" class="method"><div class="method-heading"><div class="eyebrow">AN EXPERIMENT, NOT A BLACK BOX</div><h2>Every inference has<br>an evidence trail.</h2><p>No AI API. No synthetic demo trajectories.<br>Just image measurements and testable physics.</p></div><div class="method-grid"><article><span>01</span><h3>Pixels → angles</h3><p>A color-connected component tracker follows a distinctive bob; neutral objects use patch correlation. A fixed pivot turns pixel positions into angles. No equation of motion guides the tracker.</p></article><article><span>02</span><h3>Angles → dynamics</h3><p>Fourth-order Runge–Kutta solves each candidate ODE. Multi-start nonlinear least squares estimates q, initial angle, initial velocity, camera tilt, and optionally linear drag β.</p></article><article><span>03</span><h3>Fit → prediction</h3><p>Only the first 75% is fitted. AICc compares models on that same training segment; the final 25% tests extrapolation. The selected model is a candidate, not a declaration of truth.</p></article><article><span>04</span><h3>Precision ≠ certainty</h3><p>60 moving-block residual bootstrap fits give conditional 95% intervals. Perspective, pivot placement, timestamps, and model mismatch can cause larger errors. Calibration bounds are shown separately.</p></article></div></section>
<details class="limitations"><summary>Read the assumptions, limitations, and footage provenance <span>+</span></summary><div class="limitations-content"><div><h3>Where these models apply</h3><p>A fixed pivot, planar motion, a rigid light string, and a compact bob. The camera must be nearly normal to the swing plane. The fitted offset only accounts for small camera roll; it cannot correct perspective. For an extended rigid body, q = mgd/I, and the displayed g/L interpretation requires an effective length.</p><p>β is a phenomenological linear angular damping coefficient (s⁻¹), not a material friction coefficient. Short, low-amplitude clips cannot reliably distinguish all three models. Colored backgrounds, motion blur, occlusion, variable frame rate, and a moving camera can break tracking.</p></div><div><h3>Real recordings, openly credited</h3><p>The examples are 14-second excerpts from the IRIS dataset by Rasul Khanbayov, Mohamed Rayan Barhdadi, Erchin Serpedin, and Hasan Kurban (2026). Source takes: Pendulum/pendulum_45/01.mp4 and pendulum_20/01.mp4, beginning at 0.5 s. Resized to 960 × 540, sampled at 30 fps, audio removed. The two videos are separate experiments of the same system.</p><p><a href="https://huggingface.co/datasets/rasulkhanbayov/IRIS" target="_blank" rel="noopener">Dataset & original footage ↗</a> · <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a>. Code is MIT. Noncommercial demo footage has a separate license. Example centers are segmented from the actual frames; their pivot is a geometric circle fit using training frames only. Published dataset angles are labels, not calibration truth.</p><a href="${repo}/blob/main/docs/METHODS.md">Full methods, research & reproducibility ↗</a></div></div></details>
<footer><a class="brand" href="./">Pendulum<span>Lab</span></a><span>Let the experiment have the last word.</span><a href="${repo}">Source & methods ↗</a></footer></main>`;
const video = $<HTMLVideoElement>("#video"),
  overlay = $<HTMLCanvasElement>("#overlay"),
  ctx = overlay.getContext("2d")!,
  scrub = $<HTMLInputElement>("#scrub");
let points: Point[] = [],
  pivot: Position = { x: 510, y: 30 },
  bob: Position | null = null,
  radius = 450,
  analysis: Analysis | null = null,
  selected: Model = "damped",
  showOverlay = true,
  selection: "pivot" | "bob" | "correct" | null = null,
  currentExample: string | null = "45",
  objectUrl: string | null = null,
  worker: Worker | null = null,
  abort: AbortController | null = null,
  loadId = 0;
const deg = 180 / Math.PI;
const fmt = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : "—");
const currentFit = () => analysis?.fits.find((f) => f.model === selected);
function status(message: string, error = false) {
  $("#status").hidden = !message;
  $("#status").textContent = message;
  $("#status").className = error ? "error" : "";
}
function busy(value: boolean) {
  scrub.disabled = value;
  for (const id of ["start", "end"])
    $<HTMLInputElement>(`#${id}`).disabled = value;
  for (const id of [
    "refit",
    "track",
    "export",
    "retrack",
    "upload",
    "select-pivot",
    "select-bob",
    "correct",
    "play",
  ])
    $<HTMLButtonElement>(`#${id}`).disabled = value;
  document
    .querySelectorAll<HTMLButtonElement>("[data-example]")
    .forEach((b) => (b.disabled = value));
}
async function loadExample(id: string) {
  const token = ++loadId;
  worker?.terminate();
  abort?.abort();
  video.pause();
  busy(true);
  status("Loading real experiment…");
  try {
    const res = await fetch(asset(`examples/pendulum-${id}.json`));
    if (!res.ok) throw new Error("Example could not be loaded.");
    const example = await res.json();
    if (token !== loadId) return;
    currentExample = id;
    analysis = example.analysis ?? null;
    points = example.points;
    pivot = example.pivot;
    radius = example.radius;
    bob = { x: points[0].x, y: points[0].y };
    video.src = asset(`examples/pendulum-${id}.mp4`);
    video.poster = asset(`examples/pendulum-${id}.jpg`);
    overlay.width = 960;
    overlay.height = 540;
    $("#video-title").textContent = example.title;
    $("#clip-meta").textContent = "REAL FOOTAGE · 30 FPS";
    $("#setup").hidden = true;
    document
      .querySelectorAll<HTMLButtonElement>("[data-example]")
      .forEach((b) => b.classList.toggle("active", b.dataset.example === id));
    $("#source-line").innerHTML =
      `<span>↗</span> IRIS research footage · ${id}° source label · <a href="https://huggingface.co/datasets/rasulkhanbayov/IRIS" target="_blank" rel="noopener">Source & credit</a>`;
    $<HTMLInputElement>("#start").value = "0";
    $<HTMLInputElement>("#end").value = "14";
    $<HTMLSelectElement>("#cal-kind").value = "none";
    if (analysis) {
      selected = analysis.best;
      render();
      status("");
      busy(false);
    } else await fit();
  } catch (e) {
    status(e instanceof Error ? e.message : String(e), true);
    busy(false);
  }
}
async function fit() {
  worker?.terminate();
  busy(true);
  status("Fitting physical models and estimating uncertainty…");
  try {
    const data = observations(points, pivot);
    worker = new Worker(new URL("./fit.worker.ts", import.meta.url), {
      type: "module",
    });
    await new Promise<void>((resolve, reject) => {
      worker!.onmessage = (e) => {
        if (e.data.type === "progress") status(e.data.message);
        if (e.data.type === "error") reject(new Error(e.data.message));
        if (e.data.type === "result") {
          analysis = e.data.result;
          selected = analysis!.best;
          render();
          resolve();
        }
      };
      worker!.onerror = (e) => reject(new Error(e.message));
      worker!.postMessage({ data, replicates: 60 });
    });
    status("");
  } catch (e) {
    status(e instanceof Error ? e.message : String(e), true);
  } finally {
    worker?.terminate();
    worker = null;
    busy(false);
  }
}
function render() {
  const a = analysis,
    f = currentFit();
  if (!a || !f) return;
  const minAic = Math.min(...a.fits.map((f) => f.aicc));
  $("#model-cards").innerHTML = a.fits
    .map(
      (f) =>
        `<button class="model-card ${selected === f.model ? "selected" : ""}" data-model="${f.model}" aria-pressed="${selected === f.model}"><div class="model-card-top"><strong>${labels[f.model]}</strong>${a.best === f.model ? '<span class="best">LOWEST AICc</span>' : '<span class="model-radio"></span>'}</div><div class="equation">${equations[f.model]}</div><div class="model-stat"><span>Unseen RMSE <b>${fmt(f.testRmse * deg, 2)}°</b></span><span>ΔAICc <b>${fmt(f.aicc - minAic, 1)}</b></span></div></button>`,
    )
    .join("");
  const best = a.fits.find((f) => f.model === a.best)!,
    linear = a.fits[0],
    gain = linear.testRmse / best.testRmse;
  $("#verdict").innerHTML =
    `<span>↗</span><p><strong>${labels[a.best]} leads on training AICc.</strong> ${gain > 1.1 ? `${fmt(gain, 1)}× lower unseen error than the small-angle model.` : "The unseen segment is the independent check."} Residual structure remains; treat this as an approximation, not a precision measurement.</p>`;
  const interval = (key: string) =>
    f.intervals[key]
      ? `${fmt(f.intervals[key][0])} – ${fmt(f.intervals[key][1])}`
      : "Not available";
  $("#parameters").innerHTML =
    `<div class="parameter"><div><span>Restoring coefficient</span><strong>q = g/L</strong></div><div><b>${fmt(f.params.q)}</b> <small>s⁻²</small><span class="ci">95%: ${interval("q")}</span></div></div><div class="parameter"><div><span>Angular damping</span><strong>β</strong></div><div><b>${f.model === "damped" ? fmt(f.params.beta, 4) : "0"}</b> <small>s⁻¹</small><span class="ci">${f.model === "damped" ? `95%: ${interval("beta")}` : "Fixed by this model"}</span></div></div><p class="uncertainty-note">Conditional 95% block-bootstrap intervals · ${a.bootstrapReplicates} refits</p>`;
  $("#diagnostics").innerHTML =
    `<dl><dt>Training / unseen points</dt><dd>${a.split} / ${a.observations.length - a.split}</dd><dt>Training RMSE</dt><dd>${fmt(f.trainRmse * deg, 3)}°</dd><dt>Unseen RMSE</dt><dd>${fmt(f.testRmse * deg, 3)}°</dd><dt>AICc (includes noise variance)</dt><dd>${fmt(f.aicc, 2)}</dd><dt>Initial angle / velocity</dt><dd>${fmt(f.params.angle * deg, 2)}° / ${fmt(f.params.velocity, 3)} rad/s</dd><dt>Camera-roll offset</dt><dd>${fmt(f.params.offset * deg, 2)}°</dd><dt>Lag-one residual correlation</dt><dd>${fmt(f.correlation, 3)}</dd></dl><p>All predictions use a fit to the first 75% only. AICc assumes independent Gaussian errors; correlated residuals weaken its interpretation. Bootstrap resamples circular blocks of √n training residuals, with geometry and timestamps held fixed.</p>${f.warnings.map((w) => `<p class="warning">${w}</p>`).join("")}`;
  document.querySelectorAll<HTMLButtonElement>("[data-model]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = b.dataset.model as Model;
        render();
      }),
  );
  updateCalibration();
  draw();
}
function updateCalibration() {
  const f = currentFit();
  if (!f) return;
  try {
    const c = calibrate(
      f.params.q,
      f.intervals.q,
      $<HTMLSelectElement>("#cal-kind").value as "none" | "length" | "gravity",
      +$<HTMLInputElement>("#cal-value").value,
      +$<HTMLInputElement>("#cal-error").value,
    );
    $("#cal-result").innerHTML = c
      ? `<strong>${c.quantity} = ${fmt(c.value)} ${c.unit}</strong><p>Combined envelope: ${c.bounds?.map((v) => fmt(v)).join(" – ")} ${c.unit}. Combines conditional fit interval and supplied calibration bounds; not a joint 95% interval.</p>`
      : "";
  } catch (e) {
    $("#cal-result").textContent = (e as Error).message;
  }
}
function plot(canvas: HTMLCanvasElement, residual = false) {
  canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height);
  const a = analysis,
    f = currentFit(),
    box = canvas.getBoundingClientRect(),
    dpr = devicePixelRatio || 1;
  if (!a || !f || box.width === 0) return;
  canvas.width = Math.round(box.width * dpr);
  canvas.height = Math.round(box.height * dpr);
  const c = canvas.getContext("2d")!;
  c.scale(dpr, dpr);
  const w = box.width,
    h = box.height,
    l = 40,
    r = 12,
    top = 14,
    bottom = 25;
  const ts = a.observations.map((d) => d.t),
    end = ts.at(-1)!,
    values = residual
      ? f.residuals.map((v) => v * deg)
      : a.observations.map((d) => d.angle * deg),
    limit = residual
      ? Math.max(0.25, ...values.map(Math.abs)) * 1.15
      : Math.max(10, Math.ceil(Math.max(...values.map(Math.abs)) / 10) * 10);
  const X = (t: number) => l + (t / end) * (w - l - r),
    Y = (v: number) => top + ((limit - v) / (2 * limit)) * (h - top - bottom),
    split = ts[a.split];
  c.fillStyle = "#edf0e5";
  c.fillRect(X(split), top, w - r - X(split), h - top - bottom);
  c.font = "10px ui-monospace, monospace";
  c.textAlign = "right";
  for (const v of [-limit, 0, limit]) {
    c.strokeStyle = "#e0e3dc";
    c.beginPath();
    c.moveTo(l, Y(v));
    c.lineTo(w - r, Y(v));
    c.stroke();
    c.fillStyle = "#758077";
    c.fillText(fmt(v, residual ? 1 : 0), l - 8, Y(v) + 3);
  }
  c.textAlign = "center";
  for (let t = 0; t <= end; t += end > 15 ? 5 : 2) {
    c.fillStyle = "#758077";
    c.fillText(`${t}s`, X(t), h - 6);
  }
  c.strokeStyle = "#9cab91";
  c.setLineDash([3, 4]);
  c.beginPath();
  c.moveTo(X(split), top);
  c.lineTo(X(split), h - bottom);
  c.stroke();
  c.setLineDash([]);
  if (!residual) {
    c.strokeStyle = "#73985b";
    c.lineWidth = 2;
    c.beginPath();
    f.prediction.forEach((v, i) =>
      i ? c.lineTo(X(ts[i]), Y(v * deg)) : c.moveTo(X(ts[i]), Y(v * deg)),
    );
    c.stroke();
  }
  c.fillStyle = residual ? "#a76f43" : "#405e67";
  values.forEach((v, i) => {
    c.beginPath();
    c.arc(X(ts[i]), Y(v), residual ? 1.5 : 1.6, 0, Math.PI * 2);
    c.fill();
  });
  c.strokeStyle = "#243b35";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(X(video.currentTime - (points[0]?.t ?? 0)), top);
  c.lineTo(X(video.currentTime - (points[0]?.t ?? 0)), h - bottom);
  c.stroke();
}
function draw() {
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  const f = currentFit();
  const outside =
    points.length > 0 &&
    (video.currentTime < points[0].t - 1 / 60 ||
      video.currentTime > points.at(-1)!.t + 1 / 60);
  $("#stage-label").textContent = outside
    ? "OUTSIDE ANALYZED INTERVAL"
    : "MEASUREMENT + RECOVERED DYNAMICS";
  if (showOverlay && points.length && !outside) {
    const time = video.currentTime;
    let index = 0;
    for (let i = 1; i < points.length; i++)
      if (Math.abs(points[i].t - time) < Math.abs(points[index].t - time))
        index = i;
    const p = points[index];
    ctx.lineWidth = 2;
    if (f) {
      const angle = f.prediction[index],
        x = pivot.x + radius * Math.sin(angle),
        y = pivot.y + radius * Math.cos(angle);
      ctx.strokeStyle = "#b7ef85";
      ctx.setLineDash([8, 7]);
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(x, y, 23, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#84d9f2";
    ctx.beginPath();
    points
      .slice(Math.max(0, index - 25), index + 1)
      .forEach((p, j) => (j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#84d9f2";
    ctx.fill();
  }
  if (!$("#setup").hidden || showOverlay) {
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 4, 0, Math.PI * 2);
    ctx.fill();
    if (bob && !analysis) {
      ctx.strokeStyle = "#84d9f2";
      ctx.beginPath();
      ctx.arc(bob.x, bob.y, 16, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  scrub.value = String(video.currentTime);
  $("#time").textContent =
    `${fmt(video.currentTime, 2)} / ${fmt(video.duration || 14, 2)} s`;
  $("#play").textContent = video.paused ? "▶" : "Ⅱ";
  $("#play").setAttribute(
    "aria-label",
    video.paused ? "Play experiment" : "Pause experiment",
  );
  plot($<HTMLCanvasElement>("#angle-plot"));
  plot($<HTMLCanvasElement>("#residual-plot"), true);
}
video.addEventListener("loadedmetadata", () => {
  scrub.max = String(video.duration);
  $(".stage").style.aspectRatio = String(video.videoWidth / video.videoHeight);
  draw();
});
video.addEventListener("seeked", draw);
video.addEventListener("timeupdate", draw);
video.addEventListener("error", () =>
  status(
    "Video could not be decoded. Use an H.264 MP4 supported by your browser.",
    true,
  ),
);
function tick() {
  if (!video.paused) draw();
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
$("#play").onclick = async () => {
  if (video.paused) {
    if (video.ended) video.currentTime = 0;
    try {
      await video.play();
    } catch {
      status("Press play again to start the video.", true);
    }
  } else video.pause();
  draw();
};
scrub.oninput = () => {
  video.currentTime = +scrub.value;
};
$("#overlay-toggle").onclick = () => {
  showOverlay = !showOverlay;
  $("#overlay-toggle").setAttribute("aria-pressed", String(showOverlay));
  draw();
};
for (const id of ["angle-plot", "residual-plot"])
  $(`#${id}`).onclick = (e) => {
    if (!analysis) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    video.currentTime =
      (points[0]?.t ?? 0) +
      Math.max(
        0,
        Math.min(1, (e.clientX - rect.left - 40) / (rect.width - 52)),
      ) *
        analysis.observations.at(-1)!.t;
  };
new ResizeObserver(draw).observe($(".visual-side"));
document
  .querySelectorAll<HTMLButtonElement>("[data-example]")
  .forEach((b) => (b.onclick = () => loadExample(b.dataset.example!)));
$("#refit").onclick = fit;
for (const id of ["cal-kind", "cal-value", "cal-error"])
  $(`#${id}`).addEventListener("input", updateCalibration);
$("#upload").onclick = () => $<HTMLInputElement>("#file").click();
$<HTMLInputElement>("#file").onchange = () => {
  const file = $<HTMLInputElement>("#file").files?.[0];
  if (!file) return;
  if (file.size > 500 * 1024 * 1024) {
    status("Choose a video smaller than 500 MB.", true);
    return;
  }
  ++loadId;
  worker?.terminate();
  video.pause();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(file);
  currentExample = null;
  $<HTMLSelectElement>("#cal-kind").value = "none";
  analysis = null;
  points = [];
  bob = null;
  video.removeAttribute("poster");
  video.src = objectUrl;
  $("#video-title").textContent = file.name;
  $("#clip-meta").textContent = "LOCAL VIDEO · PRIVATE";
  $("#model-cards").innerHTML =
    '<div class="empty-state">Your video is ready.<br>Mark the pivot and bob below, then track & fit.</div>';
  $("#parameters").innerHTML = "";
  $("#verdict").innerHTML = "";
  $("#source-line").textContent = "Your local video · never uploaded";
  $("#setup").hidden = false;
  $("#diagnostics").innerHTML = "Fit your video to inspect diagnostics.";
  $("#cal-result").textContent = "";
  document
    .querySelectorAll(".tab")
    .forEach((b) => b.classList.remove("active"));
  status("Choose the free-motion range, then mark the pivot and bob.");
  video.addEventListener(
    "loadedmetadata",
    () => {
      overlay.height = Math.round((video.videoHeight / video.videoWidth) * 960);
      pivot = { x: 480, y: 40 };
      $<HTMLInputElement>("#start").value = "0";
      $<HTMLInputElement>("#end").value = String(
        Math.min(14, video.duration - 0.05),
      );
      draw();
    },
    { once: true },
  );
  $("#setup").scrollIntoView({ behavior: "smooth", block: "center" });
};
$("#retrack").onclick = () => {
  $("#setup").hidden = false;
  $("#setup-help").textContent =
    "The existing pivot and starting bob are ready. You can retrack automatically, remark either point, or correct any frame and refit.";
  $("#setup").scrollIntoView({ behavior: "smooth", block: "center" });
};
$("#select-pivot").onclick = () => {
  video.pause();
  selection = "pivot";
  $("#setup-help").textContent =
    "Click the fixed suspension point on the video.";
  $(".stage").scrollIntoView({ behavior: "smooth", block: "center" });
};
$("#select-bob").onclick = async () => {
  video.pause();
  try {
    await seek(video, +$<HTMLInputElement>("#start").value);
    selection = "bob";
    $("#setup-help").textContent =
      "Click the center of the bob at the start of free motion.";
    $(".stage").scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    status((e as Error).message, true);
  }
};
$("#correct").onclick = () => {
  video.pause();
  selection = "correct";
  $("#setup-help").textContent =
    "Seek to a frame using the time slider, then click the true bob center. Refit afterward.";
  $(".stage").scrollIntoView({ behavior: "smooth", block: "center" });
};
overlay.onclick = (e) => {
  if (!selection) return;
  const r = overlay.getBoundingClientRect(),
    p = {
      x: ((e.clientX - r.left) / r.width) * overlay.width,
      y: ((e.clientY - r.top) / r.height) * overlay.height,
    };
  if (selection === "pivot") pivot = p;
  if (selection === "bob") bob = p;
  if (selection === "correct") {
    const time = video.currentTime,
      i = points.findIndex((p) => Math.abs(p.t - time) < 1 / 45);
    const point = { t: time, ...p, confidence: 1 };
    if (i >= 0) points[i] = point;
    else points.push(point);
    points.sort((a, b) => a.t - b.t);
    analysis = null;
    $("#model-cards").innerHTML =
      '<div class="empty-state">Measurement corrected. Refit to update the models.</div>';
    $("#parameters").innerHTML = "";
    $("#verdict").innerHTML = "";
  }
  if (selection !== "correct" && analysis) {
    analysis = null;
    $("#model-cards").innerHTML =
      '<div class="empty-state">Geometry changed. Track & fit to update results.</div>';
    $("#parameters").innerHTML = "";
    $("#verdict").innerHTML = "";
  }
  selection = null;
  $("#setup-help").textContent =
    `Pivot: (${fmt(pivot.x, 0)}, ${fmt(pivot.y, 0)}). ${bob ? "Bob selected. Ready to track." : "Now mark the bob."}`;
  draw();
};
$("#track").onclick = async () => {
  if (!bob) {
    status("Mark the bob first.", true);
    return;
  }
  const start = +$<HTMLInputElement>("#start").value,
    end = +$<HTMLInputElement>("#end").value;
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end > video.duration ||
    end - start < 2 ||
    end - start > 30
  ) {
    status("Choose a 2–30 second range inside the video.", true);
    return;
  }
  video.pause();
  abort = new AbortController();
  busy(true);
  $("#cancel").hidden = false;
  try {
    points = await track(
      video,
      pivot,
      bob,
      start,
      end,
      (p) => status(`Tracking the real frames… ${Math.round(p * 100)}%`),
      abort.signal,
    );
    radius =
      points.reduce((s, p) => s + Math.hypot(p.x - pivot.x, p.y - pivot.y), 0) /
      points.length;
    await seek(video, start);
    await fit();
  } catch (e) {
    status(
      (e as Error).name === "AbortError"
        ? "Tracking cancelled."
        : (e as Error).message,
      true,
    );
  } finally {
    busy(false);
    $("#cancel").hidden = true;
  }
};
$("#cancel").onclick = () => abort?.abort();
$("#export").onclick = () => {
  if (!analysis) return;
  const result = {
    schemaVersion: 1,
    source: currentExample
      ? `IRIS Pendulum/pendulum_${currentExample}/01.mp4 (0.5–14.5 s)`
      : $("#video-title").textContent,
    pivot,
    radius,
    points,
    analysis,
    calibration: {
      kind: $<HTMLSelectElement>("#cal-kind").value,
      value: +$<HTMLInputElement>("#cal-value").value,
      absoluteBound: +$<HTMLInputElement>("#cal-error").value,
    },
    limitations:
      "Conditional block-bootstrap intervals. No independent g/L identification. See docs/METHODS.md.",
  };
  const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "pendulum-lab-results.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
loadExample("45");
