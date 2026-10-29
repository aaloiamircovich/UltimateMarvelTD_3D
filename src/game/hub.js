// Shared by the plaza renderer and its accessible navigation.
export const HUB_STATIONS = [
  { id: "story", name: "HISTORIA", subtitle: "Base Avengers", color: "#64e5ff", x: -9, z: -8, number: "01" },
  { id: "infinite", name: "INFINITO", subtitle: "Resistí una oleada más", color: "#b69aff", x: 9, z: -8, number: "02" },
  { id: "summon", name: "INVOCACIONES", subtitle: "Centro de reclutamiento", color: "#ffcf72", x: -14, z: 3, number: "03" },
  { id: "traits", name: "TRAITS", subtitle: "Laboratorio de habilidades", color: "#7eefa9", x: 14, z: 3, number: "04" },
  { id: "grades", name: "GRADES", subtitle: "Centro de entrenamiento", color: "#ff8faa", x: 10, z: 14, number: "05" },
];

export function moveAvatar(position, dx, dz, dt) {
  const length = Math.hypot(dx, dz);
  if (!length) return { x: position.x, z: position.z };
  const step = 6 * Math.min(Math.max(dt, 0), 0.1) / length;
  const result = { x: position.x, z: position.z };
  const blocked = (x, z) => Math.abs(x) > 19 || Math.abs(z) > 19 ||
    HUB_STATIONS.some(s => Math.abs(x - s.x) < 3.3 && Math.abs(z - (s.z - 1.7)) < 1);
  if (!blocked(result.x + dx * step, result.z)) result.x += dx * step;
  if (!blocked(result.x, result.z + dz * step)) result.z += dz * step;
  return result;
}

export const nearbyStation = position => HUB_STATIONS.find(s =>
  Math.hypot(position.x - s.x, position.z - s.z) < 3.6);
