import * as THREE from "three";
import { box, cylinder, material } from "./models.js";
import { BATTLE_PATH, TERRAIN_MAP, toWorld } from "../game/combat-data.js";

export function buildBattleMap(world) {
  const s = world.scene;
  box(s, "#16283a", [0, -0.28, 0.125], [25.5, 0.5, 19.5]);
  const colors = { 0: "#206b87", 1: "#3c805f", 2: "#3b4a5e", 3: "#697d91", 5: "#263647", 11: "#7392a0" };
  const tiles = new Map();
  const geometry = new THREE.BoxGeometry(.98, .12, .98);
  for (const [terrain, color] of Object.entries(colors)) {
    const count = TERRAIN_MAP.flat().filter(t => t === Number(terrain)).length;
    const mesh = new THREE.InstancedMesh(geometry, material(color), count);
    mesh.receiveShadow = true;
    tiles.set(Number(terrain), { mesh, index: 0 }); s.add(mesh);
  }
  const matrix = new THREE.Matrix4();
  for (const [y, row] of TERRAIN_MAP.entries()) for (const [x, terrain] of row.entries()) {
    const p = toWorld({ x: x * 32 + 16, y: y * 32 + 16 });
    const tile = tiles.get(terrain);
    tile.mesh.setMatrixAt(tile.index++, matrix.makeTranslation(p.x, 0, p.z));
    if (terrain === 5 && y < 2 && x > 4 && x < 14) {
      box(s, "#40556c", [p.x, 0.65, p.z], [0.97, 1.3, 0.97]);
      box(s, "#a5dff1", [p.x, 0.9, p.z + .49], [.65, .23, .02]);
    }
  }
  const points = BATTLE_PATH.map(p => { const w = toWorld(p); return new THREE.Vector3(w.x, .14, w.z); });
  const path = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineDashedMaterial({ color: "#efcb75", dashSize: .3, gapSize: .2 }));
  path.computeLineDistances(); s.add(path);
  const start = toWorld(BATTLE_PATH[1]), end = toWorld(BATTLE_PATH.at(-2));
  const portal = new THREE.Group(); portal.position.set(start.x, 1, start.z); portal.rotation.y = Math.PI / 2;
  portal.add(new THREE.Mesh(new THREE.TorusGeometry(.85, .09, 8, 40), material("#b17aff", true)));
  s.add(portal); world.portal = portal;
  const shield = new THREE.Mesh(new THREE.SphereGeometry(.85, 24, 16), new THREE.MeshBasicMaterial({ color: "#65dce5", transparent: true, opacity: .25, wireframe: true }));
  shield.position.set(end.x, .65, end.z); s.add(shield); world.shield = shield;
  cylinder(s, "#315979", [end.x, .14, end.z], [.9, .9, .18]);
  world.label("BASE AVENGERS", 0, 1.7, -8.4, "#cae6f6", 4);
  world.label("ENTRADA", start.x, .2, start.z + 1.25, "#d1a7ff", 2);
  world.label("BASE", end.x, .2, end.z + 1.3, "#85e6ee", 1.4);
}
