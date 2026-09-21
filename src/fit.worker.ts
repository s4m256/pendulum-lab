import { analyze, type Observation } from "./physics";
self.onmessage = (
  event: MessageEvent<{ data: Observation[]; replicates: number }>,
) => {
  try {
    const result = analyze(event.data.data, event.data.replicates, (message) =>
      self.postMessage({ type: "progress", message }),
    );
    self.postMessage({ type: "result", result });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
