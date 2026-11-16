import { it, expect } from "vitest";
import { segments, serialize, pathOperation } from "../src/pathEditor";
it("normalizes relative paths, arcs, quadratics, and shorthand", () => {
  const out = segments("m10 10h20v20q5 5 10 0a4 4 0 0 0 5 5z");
  expect(serialize(out)).not.toMatch(/[hvaq]/i);
  expect(out[0]).toEqual(["M", 10, 10]);
});
it("adds Bezier anchors without altering curve endpoints", () => {
  const d = "M0 0C0 10 10 10 10 0";
  const split = segments(pathOperation(d, "add")[0]);
  expect(split).toHaveLength(3);
  expect(split[2].slice(-2)).toEqual([10, 0]);
  expect(split[1].slice(-2)).toEqual([5, 7.5]);
});
it("closes each subpath and breaks compounds", () => {
  const d = "M0 0L10 0M20 20L30 30";
  expect(pathOperation(d, "close")[0].match(/Z/g)).toHaveLength(2);
  expect(pathOperation(d, "break")).toHaveLength(2);
});
