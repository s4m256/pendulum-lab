import { describe, it, expect } from "vitest";
import {
  analyze,
  calibrate,
  optimize,
  simulate,
  validate,
  observations,
} from "../src/physics";
import fs from "node:fs";
const p = { q: 19.62, beta: 0.075, angle: 0.8, velocity: 0.1, offset: 0.02 };
const times = Array.from({ length: 241 }, (_, i) => i / 30);
describe("physics and inverse inference", () => {
  it("RK4 agrees with the exact harmonic solution", () => {
    const y = simulate(times, { ...p, beta: 0, offset: 0 }, "linear");
    expect(
      Math.max(
        ...y.map((v, i) =>
          Math.abs(
            v -
              (p.angle * Math.cos(Math.sqrt(p.q) * times[i]) +
                (p.velocity / Math.sqrt(p.q)) *
                  Math.sin(Math.sqrt(p.q) * times[i])),
          ),
        ),
      ),
    ).toBeLessThan(1e-6);
  });
  it("nonlinear integration converges when the step is halved", () => {
    const a = simulate(times, p, "damped", 1 / 120),
      b = simulate(times, p, "damped", 1 / 240);
    expect(Math.max(...a.map((v, i) => Math.abs(v - b[i])))).toBeLessThan(1e-6);
  });
  it("recovers known damped parameters in a solver-only benchmark", () => {
    const y = simulate(times, p, "damped", 1 / 300);
    const data = times.map((t, i) => ({
      t,
      angle: y[i] + 0.001 * Math.sin(i * 2.399),
    }));
    const fit = optimize(data, "damped", {
      q: 18,
      beta: 0.02,
      angle: 0.7,
      velocity: 0,
      offset: 0,
    });
    expect(fit.q).toBeCloseTo(p.q, 2);
    expect(fit.beta).toBeCloseTo(p.beta, 3);
    expect(fit.offset).toBeCloseTo(p.offset, 3);
  });
  it("does not leak withheld measurements into fitted parameters or model selection", () => {
    const data = times.map((t, i) => ({
      t,
      angle: simulate(times, p, "damped")[i],
    }));
    const first = analyze(data, 0),
      changed = analyze(
        data.map((d, i) => ({
          ...d,
          angle: d.angle + (i >= first.split ? 0.3 : 0),
        })),
        0,
      );
    expect(changed.fits.map((f) => f.params)).toEqual(
      first.fits.map((f) => f.params),
    );
    expect(changed.best).toEqual(first.best);
    expect(changed.fits[2].testRmse).toBeGreaterThan(
      first.fits[2].testRmse + 0.1,
    );
  });
  it("refuses constant, short, unordered, and nonfinite trajectories", () => {
    expect(() => validate(times.map((t) => ({ t, angle: 0 })))).toThrow(
      "Too little",
    );
    expect(() =>
      validate(times.map((t) => ({ t: t / 10, angle: Math.sin(t) }))),
    ).toThrow("two seconds");
    expect(() =>
      validate(
        times.map((t, i) => ({ t: i === 100 ? 0 : t, angle: Math.sin(t) })),
      ),
    ).toThrow("ordered");
    expect(() =>
      validate(
        times.map((t, i) => ({ t, angle: i === 2 ? NaN : Math.sin(t) })),
      ),
    ).toThrow("finite");
  });
  it("requires external information to convert q into g or L", () => {
    expect(calibrate(20, [19, 21], "none", 1)).toBeNull();
    expect(calibrate(20, [19, 21], "length", 0.5, 0.01)).toEqual({
      quantity: "g",
      value: 10,
      bounds: [9.31, 10.71],
      unit: "m/s²",
    });
    expect(calibrate(20, [19, 21], "gravity", 10)?.value).toBe(0.5);
    expect(() => calibrate(20, [19, 21], "length", 0)).toThrow();
    expect(() => calibrate(20, [19, 21], "length", 1, 2)).toThrow();
  });
});
describe("real video regression fixtures", () => {
  for (const id of ["45", "20"])
    it(`fits actual IRIS ${id}° image measurements and predicts held-out frames`, () => {
      const d = JSON.parse(
          fs.readFileSync(`public/examples/pendulum-${id}.json`, "utf8"),
        ),
        data = observations(d.points, d.pivot),
        a = analyze(data, 20),
        f = a.fits.find((f) => f.model === "damped")!;
      expect(d.points).toHaveLength(420);
      expect(a.best).toBe("damped");
      expect((f.testRmse * 180) / Math.PI).toBeLessThan(1.1);
      expect(f.params.q).toBeGreaterThan(18);
      expect(f.params.q).toBeLessThan(20);
      expect(f.params.beta).toBeGreaterThan(0.025);
      expect(f.params.beta).toBeLessThan(0.1);
      expect(f.intervals.q[0]).toBeLessThan(f.params.q);
      expect(f.intervals.q[1]).toBeGreaterThan(f.params.q);
      if (id === "45") expect(f.warnings.join(" ")).toContain("correlated");
      expect(f.correlation).toBeGreaterThan(0.2);
    });
});
