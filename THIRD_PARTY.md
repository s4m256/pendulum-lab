# Third-party materials

## IRIS research footage

Creators: Rasul Khanbayov, Mohamed Rayan Barhdadi, Erchin Serpedin, Hasan Kurban.

- Dataset: https://huggingface.co/datasets/rasulkhanbayov/IRIS
- Research/code: https://github.com/KurbanIntelligenceLab/iris-bench
- Paper: https://arxiv.org/abs/2603.16432
- License: Creative Commons Attribution–NonCommercial 4.0 International, https://creativecommons.org/licenses/by-nc/4.0/
- Source revision: `c253822f55431ca80ef2084de4bc5e79d1a488f1`.
- Source files: `Pendulum/pendulum_45/01.mp4` and `Pendulum/pendulum_20/01.mp4`.
- Changes: trim source seconds 0.5–14.5; resize to 960×540; sample at 30 fps; H.264 encode; remove audio. Extract color-segmented bob centers and a geometric pivot. No synthetic trajectory replacement, motion retiming, or generative editing.
- Per-file SHA-256 hashes are recorded in `public/examples/pendulum-{20,45}.json`.

This license applies to `public/examples/*`, the example measurements and derivatives, and the footage visible in `docs/screenshot.png`, `docs/mobile.png`, and `docs/demo.gif`. The public demo is noncommercial. The MIT code license does not relicense these materials. No endorsement by the original researchers is implied.

## Fonts

DM Sans and Manrope are served by Google Fonts and distributed under the SIL Open Font License. Browser requests for fonts contact Google's font servers; user videos and measurements are not sent there. System fonts are used if that service is unavailable.
