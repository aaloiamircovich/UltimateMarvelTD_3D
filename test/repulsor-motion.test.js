import test from "node:test";
import assert from "node:assert/strict";
import { shotEnvelope, followPose, muzzleWeight } from "../src/render/repulsor-motion.js";

test("repulsor pose freezes when simulation is paused and is frame-rate independent", () => {
  assert.equal(followPose(.6, 1, 0), .6);
  const a = followPose(0, 1, .1);
  const b = followPose(followPose(0, 1, .05), 1, .05);
  assert.ok(Math.abs(a - b) < 1e-12);
  assert.equal(shotEnvelope(Infinity), 0);
  assert.equal(shotEnvelope(-1), 0);
  assert.equal(shotEnvelope(0), 1);
  assert.equal(shotEnvelope(.5), 0);
  assert.ok(shotEnvelope(.2) > shotEnvelope(.4));
});

test("visual muzzle offset vanishes at impact, including short-distance shots", () => {
  assert.equal(muzzleWeight(0, 5), 1);
  assert.equal(muzzleWeight(5, 5), 0);
  assert.equal(muzzleWeight(6, 5), 0);
  assert.equal(muzzleWeight(.01, 0), 0);
});
