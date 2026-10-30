import { toWorld, PIXELS_PER_UNIT } from "./combat-data.js";

// Presentation-only snapshots. Rocket targets within its OWNER's range;
// Peni additionally requires the target to be inside the mine's two radii.
export function deviceViews(heroes) {
  return heroes.flatMap(hero => {
    const system = hero.abilitySystem?.fieldDevice, device = system?.device;
    if (!device) return [];
    const turret = hero.id === "rocket_raccoon", stats = hero.getEffectiveStats();
    return [{ id: hero.uid, ownerId: hero.uid, heroId: hero.id,
      kind: turret ? "turret" : "mine",
      ...toWorld(turret ? {x:hero.x+14,y:hero.y+12} : device),
      owner: toWorld(hero), range: stats.range / PIXELS_PER_UNIT,
      pattern: hero.rangePattern, geometryScale: stats.rangeGeometryScale || 1,
      life: device.life, armed: turret || device.arm <= 0,
      label: system.getDisplayState().label,
      triggerRadius: turret ? 0 : 26 / PIXELS_PER_UNIT,
      effectRadius: turret ? 0 : 65 / PIXELS_PER_UNIT }];
  });
}
