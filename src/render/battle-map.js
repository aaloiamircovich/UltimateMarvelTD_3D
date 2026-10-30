import * as THREE from "three";
import { box, cylinder, material } from "./models.js";
import { missionEndpoints } from "../game/missions.js";
import { toWorld, PIXELS_PER_UNIT } from "../game/combat-data.js";

export function buildBattleMap(world, mission) {
  const s = new THREE.Group();
  const BATTLE_PATH = mission.path, TERRAIN_MAP = mission.terrain;
  const urban = mission.level.id === "level_2", wakanda = mission.level.id === "level_3";
  const sanctum = mission.level.id === "level_4", cell = mission.gridSize / PIXELS_PER_UNIT;
  const label = (...args) => s.add(world.label(...args));
  box(s, "#16283a", [0, -0.28, 0.125], [25.5, 0.5, 19.5]);
  const colors = { 0: "#206b87", 1: "#3c805f", 2: "#3b4a5e", 3: "#697d91", 5: "#263647", 11: "#7392a0" };
  if (wakanda) Object.assign(colors, { 0: "#167e86", 2: "#9c8260", 3: "#71608b", 5: "#35324d" });
  if (sanctum) Object.assign(colors, {0:"#24334a",1:"#4a2924",11:"#5b3328",12:"#6b3d2b",2:"#71513c",3:"#24131e",4:"#35202c"});
  const tiles = new Map();
  const geometry = new THREE.BoxGeometry(cell-.02, .12, cell-.02);
  for (const [terrain, color] of Object.entries(colors)) {
    const count = TERRAIN_MAP.flat().filter(t => t === Number(terrain)).length;
    const mesh = new THREE.InstancedMesh(geometry, material(color), count);
    mesh.receiveShadow = true;
    tiles.set(Number(terrain), { mesh, index: 0 }); s.add(mesh);
  }
  const matrix = new THREE.Matrix4();
  for (const [y, row] of TERRAIN_MAP.entries()) for (const [x, terrain] of row.entries()) {
    const p = toWorld({ x: (x+.5) * mission.gridSize, y: (y+.5) * mission.gridSize });
    const tile = tiles.get(terrain);
    tile.mesh.setMatrixAt(tile.index++, matrix.makeTranslation(p.x, 0, p.z));
    if (terrain === 5 && (urban || mission.level.id === "level_1" && y < 2 && x > 4 && x < 14)) {
      box(s, "#40556c", [p.x, 0.65, p.z], [0.97, 1.3, 0.97]);
      box(s, "#a5dff1", [p.x, 0.9, p.z + .49], [.65, .23, .02]);
    }
  }
  const points = BATTLE_PATH.map(p => { const w = toWorld(p); return new THREE.Vector3(w.x, .14, w.z); });
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: "#efcb75", dashSize: .3, gapSize: .2 }));
  path.computeLineDistances(); s.add(path);
  const endpoints = missionEndpoints(mission);
  const start = toWorld(endpoints.start), end = toWorld(endpoints.end);
  const portal = new THREE.Group(); portal.position.set(start.x, 1, start.z); portal.rotation.y = Math.PI / 2;
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(.85, .09, 8, 40), material(mission.level.theme.accent, true)));
  s.add(portal);
  const shield = new THREE.Mesh(new THREE.SphereGeometry(.85, 24, 16), new THREE.MeshBasicMaterial({ color: "#65dce5", transparent: true, opacity: .25, wireframe: true }));
  shield.position.set(end.x, .65, end.z); s.add(shield);
  cylinder(s, "#315979", [end.x, .14, end.z], [.9, .9, .18]);
  label(mission.level.theme.label.toUpperCase(), 0, 1.7, -8.4, "#cae6f6", 4);
  label("ENTRADA", start.x, .2, start.z + 1.25, "#d1a7ff", 2);
  label("BASE", end.x, .2, end.z + 1.3, "#85e6ee", 1.4);
  for (const landmark of mission.level.mission?.mechanic?.landmarks || []) {
    const p = toWorld(landmark), radius = landmark.radius / PIXELS_PER_UNIT;
    const zone = new THREE.Mesh(new THREE.RingGeometry(radius-.025, radius, 64), material(landmark.color, true));
    zone.rotation.x = -Math.PI/2; zone.position.set(p.x,.23,p.z);
    zone.name = "mission-zone"; zone.userData.radius = radius; s.add(zone);
    const rune = new THREE.Mesh(new THREE.TorusGeometry(.3,.025,4,6), material(landmark.color,true));
    rune.rotation.x = -Math.PI/2; rune.position.set(p.x,.25,p.z); s.add(rune);
    label(landmark.label,p.x,.5,p.z,landmark.color,1.5);
  }
  return { group: s, portal, shield };
}
