# Methods and scientific limits

## Question and scope

Can equations fitted to the early motion of a real pendulum predict its later motion? Pendulum Lab implements system identification for three specified physical hypotheses. It does not discover arbitrary equations, infer mass, or claim all visible pendulums obey a point-mass model.

## Research-informed architecture

Reviewed before implementation, 2026-09-20:

- [Tracker / Open Source Physics](https://opensourcephysics.github.io/tracker/) is a mature general-purpose video analysis and modeling tool. This project deliberately concentrates on fitting, identifiability, and an explicit extrapolation check.
- [trackpy](https://soft-matter.github.io/trackpy/) provides particle localization and trajectory linking. A single prominent pendulum bob needs a much smaller image-processing pipeline; no Python runtime is shipped to the browser.
- [Physics-as-Inverse-Graphics, Jaques et al.](https://arxiv.org/abs/1905.11169) couples video representations to known physical dynamics. For this constrained experiment, explicit tracking and low-dimensional fitting are easier to audit than learned latent states.
- [IRIS](https://github.com/KurbanIntelligenceLab/iris-bench) studies inverse recovery across multiple real systems. Its attributed real recordings supply the examples; its learned inference code is not used.

Decision: static TypeScript, browser-native video decoding, Canvas image processing, and a Web Worker for the numerical core. No backend, ML weights, user accounts, paid APIs, or server-side video uploads. Bundle size is small enough to inspect the entire inference implementation.

## Measurement pipeline

Coordinates use a 960-pixel-wide analysis canvas preserving aspect ratio. The user marks the fixed pivot and a bob center at the beginning of a free-motion interval. The tracker samples at 30 Hz, up to 30 seconds. Strongly colored patches use a fixed normalized-RGB reference and connected components. Near-neutral patches use zero-mean normalized grayscale patch correlation. Both use local displacement and radial geometry gates; neither uses fitted equations, predicted angular motion, or a simulated trajectory.

Low-confidence frames are omitted. Four consecutive losses or more than 15% missing frames stop automatic tracking with a message. Confidence is a matching/area score, **not** a calibrated probability. A user may correct a displayed frame by clicking the bob and refit. Large rotations of a patterned bob, changing illumination, similarly colored backgrounds, occlusion, and camera motion are failure cases. Automatic tracking is intentionally semi-automatic, not universal.

Browser seeking samples just inside the requested frame boundary (+1 ms), avoiding floating-point boundary ambiguities observed in Chromium. Nominal sample times are used in the fit. Constant-frame-rate H.264 MP4 is recommended; variable-frame-rate files and duplicated frames can introduce timing error. Uploaded videos are decoded using the browser's media stack, so codec support varies. There is no frame-accurate WebCodecs demuxer or rolling-shutter correction.

### Bundled real examples

Two independent IRIS takes, source labels 45° and 20°, are trimmed from source time 0.5 s for 14 s. Original footage is 3840×2160 at 60 fps. Preparation scales to 960×540 and resamples to 30 fps without changing time. 420 bob centers per clip are extracted by HSV segmentation of the yellow-green ball. The geometric pivot is obtained by fitting a circle to the **first 315 image centers only**, using linear least squares on x²+y² = 2cx x + 2cy y + k. This uses image geometry, not an ODE or an assumed g.

A circular arc fitted over a limited range can have a biased center, especially under perspective. The examples' estimated pivots are not independently calibrated. Small radial residuals (approximately 0.85 px and 1.28 px on training frames) do not prove a frontal camera or correct physical geometry. The source's rope-length value of 0.5 m is not automatically treated as pivot-to-center effective length. Source angle labels are not substituted for measured angles. SHA-256 hashes and the dataset revision make the preprocessing traceable.

## Equations and identifiability

Let a(t) be the physical angle relative to the equilibrium direction and θobs(t) = a(t) + c, where c is a small camera-roll offset. Pixel observations are θobs = atan2(x − cx, y − cy). c is restricted to ±0.35 rad; it cannot correct perspective.

| Model | Equation | Estimated dynamic/nuisance parameters |
|---|---|---|
| Small-angle | a″ + q a = 0 | q, a(0), a′(0), c |
| Nonlinear | a″ + q sin(a) = 0 | q, a(0), a′(0), c |
| Damped nonlinear | a″ + β a′ + q sin(a) = 0 | q, β, a(0), a′(0), c |

For a compact bob and light rigid string, q = g/L. Angle-time measurements are unchanged under (g,L) → (kg,kL), so the parameters cannot be independently identified without additional physical information. Mass cancels out. β has units s⁻¹ and summarizes linear angular damping; it is not the air's viscosity or a standalone material friction coefficient. For a physical pendulum, q = mgd/I instead.

Known L gives g = qL. Assumed g gives L = g/q. A supplied absolute calibration bound is combined conservatively with the conditional q interval by endpoint propagation. This envelope is **not a joint 95% confidence interval**. In particular, assuming g to recover L is not also a measurement of g.

Structural identifiability is distinct from practical identifiability: low amplitude, short duration, high noise, weak damping, or a nearly stationary bob can make parameters uninformative even when the equations are structurally identifiable. The app rejects fewer than 40 observations, nonfinite/unordered data, less than 2 seconds, and less than 0.06 rad angular range. It warns about fewer than two fitted cycles, parameter bounds, zero-boundary damping, and correlated residuals. It does not supply a complete profile-likelihood or observability-rank proof for each uploaded recording.

## Numerical inference

- Integrate with explicit fourth-order Runge–Kutta, internal steps at most 1/120 s, stepping exactly to each requested sample time. Fit angles directly; no noisy numerical differentiation of measured positions.
- Find a starting frequency by scanning 0.4–18 rad/s in 0.025 rad/s increments and solving a linear sinusoid-plus-offset fit at each frequency.
- Optimize two initial guesses per model with finite-difference Jacobians and damped Gauss–Newton updates (Levenberg–Marquardt-style). Use a nonlinear amplitude correction for one frequency seed.
- Minimize unweighted squared angular residuals, with q in [0.04,400] s⁻², β in [0,4] s⁻¹, initial angle in [−3,3] rad, velocity in [−30,30] rad/s, and c in [−0.35,0.35] rad.
- The first floor(0.75n) observations are used for dynamic fitting. Simulate from the fitted initial condition through the full interval without resetting at the split. All reported coefficients are training-only estimates.
- Candidate ranking is by training AICc. With K including estimated noise variance, AICc = n log(RSS/n) + 2K + 2K(K+1)/(n−K−1). The additive Gaussian constant is omitted consistently. Training and unseen RMSE are displayed in degrees.

AICc assumes independent Gaussian residuals. Video errors are often correlated; model ranking is a heuristic, not a probability that a model is true. There is no all-data refit after ranking. The unseen segment remains an honest temporal prediction check, but repeatedly tuning a setup after looking at that segment makes it no longer an independent validation dataset.

The present candidate set contrasts undamped models against a damped nonlinear model. It can reveal the need for decay; it cannot attribute all improvement specifically to nonlinearity because a damped linear candidate is absent. Quadratic drag, pivot friction, driven motion, string elasticity, and out-of-plane dynamics are not fitted. Multiple starts reduce, but do not eliminate, local-minimum failures.

## Uncertainty

For each fitted model, center its training residuals. Generate 60 circular moving-block resamples with block length round(√n), add them to the model trajectory, and refit starting from the optimum. Report 2.5th and 97.5th percentiles. A seeded PRNG makes runs reproducible. Boundary solutions remain in the resample distribution; zero-boundary damping receives a warning.

This is a lightweight conditional uncertainty estimate. Geometry, frame times, selected tracking points, and model family are fixed. It does not include calibration bias, unmodeled perspective, changing pivot, all temporal dependence, or model-selection uncertainty. Sixty resamples provide coarse tail quantiles. Lag-one residual correlation is reported; |ρ| > 0.5 triggers a warning. Narrow intervals alongside visible residual structure must not be read as precise experimental ground truth.

## Validation strategy

1. Compare RK4 to the exact harmonic oscillator solution and verify nonlinear step-size convergence.
2. Recover known coefficients in solver-only synthetic test fixtures. These are explicitly tests, never the app's demonstration measurements.
3. Perturb only the unseen segment and require identical fitted coefficients and training model selection.
4. Check rejection of insufficient/malformed observations and calibration/identifiability logic.
5. Refit both real video-derived trajectories and bound withheld prediction errors.
6. Exercise the actual upload → browser decode → pixel tracker → worker fit → calibration/export path in Playwright, plus playback, model switching, frame correction, and mobile layout.
7. Run the same browser suite against the deployed public URL.

The validation establishes numerical consistency and useful prediction on two clips, not population-level accuracy across cameras, pendulums, or recording conditions. No independently measured gravitational-acceleration accuracy claim is made.
