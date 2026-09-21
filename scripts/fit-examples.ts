import fs from "node:fs";
import { analyze, observations } from "../src/physics.ts";
for (const id of ["45", "20"]) {
  const path = `public/examples/pendulum-${id}.json`,
    data = JSON.parse(fs.readFileSync(path, "utf8"));
  data.analysis = analyze(observations(data.points, data.pivot), 60);
  fs.writeFileSync(path, JSON.stringify(data));
  console.log(
    id,
    data.analysis.fits.map((f) => ({
      model: f.model,
      q: f.params.q,
      beta: f.params.beta,
      train: (f.trainRmse * 180) / Math.PI,
      test: (f.testRmse * 180) / Math.PI,
      aicc: f.aicc,
      ci: f.intervals.q,
    })),
  );
}
