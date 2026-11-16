const { parentPort, workerData } = require("node:worker_threads");
const engine = require("../core/engine.cjs");
(async () => {
  try {
    const result = await engine[workerData.operation](...workerData.args);
    parentPort.postMessage({ result });
  } catch (e) {
    parentPort.postMessage({ error: e.message });
  }
})();
