// Pure visual envelopes in simulation seconds; these never schedule damage.
export function shotEnvelope(age) {
  if (!Number.isFinite(age) || age < 0) return 0;
  if (age <= .12) return 1;
  const t = Math.min(1, (age - .12) / .38);
  return 1 - t * t * (3 - 2 * t);
}

export function followPose(current, target, elapsed) {
  return current + (target - current) * (1 - Math.exp(-24 * Math.max(0, elapsed)));
}

export function muzzleWeight(distanceTravelled, distanceToTarget) {
  return Math.max(0, 1 - distanceTravelled / Math.max(.001, distanceToTarget));
}
