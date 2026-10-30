import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import "./model-studio.css";
import { ironManUrl } from "../render/hero-assets.js";

const $ = id => document.getElementById(id);
const viewport = $("viewport"), status = $("status");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
viewport.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color("#091424");
const room = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture; room.dispose(); pmrem.dispose();
scene.add(new THREE.HemisphereLight(0xb4e7ff, 0x34445e, 1.5));
const key = new THREE.DirectionalLight(0xffe4bf, 3);
key.position.set(4, 6, 5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); scene.add(key);
const rim = new THREE.DirectionalLight(0x67b8ff, 2); rim.position.set(-3, 3, -3); scene.add(rim);
const grid = new THREE.GridHelper(10, 20, 0x53758b, 0x1c344a); scene.add(grid);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: 0x101f30, roughness: 0.85 }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -0.012; ground.receiveShadow = true; scene.add(ground);
const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 150);
const controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true;
let model, mixer, clips = [], playing = true, extent = 2.5, requestId = 0;
function frame() { camera.position.set(extent * 1.15, extent * 0.7, extent * 1.8); controls.target.set(0, 1, 0); controls.update(); }
frame();
new ResizeObserver(() => { const { width, height } = viewport.getBoundingClientRect(); renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); }).observe(viewport);
function dispose(group) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const m of (Array.isArray(node.material) ? node.material : node.material ? [node.material] : [])) {
      materials.add(m); Object.values(m).filter(v => v?.isTexture).forEach(t => textures.add(t));
    }
    node.skeleton?.dispose();
  });
  for (const resource of [...geometries, ...materials, ...textures]) resource.dispose();
}
function wireframe() {
  model?.traverse(node => { for (const m of (Array.isArray(node.material) ? node.material : node.material ? [node.material] : [])) m.wireframe = $("wireframe").checked; });
}
$("model-file").onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  const current = ++requestId;
  status.dataset.state = "loading"; status.textContent = "Cargando el modelo…";
  try {
    if (!file.name.toLowerCase().endsWith(".glb") || file.size > 100 * 1024 * 1024) throw Error("Elegí un archivo GLB de hasta 100 MB.");
    const bytes = await file.arrayBuffer(), view = new DataView(bytes);
    if (bytes.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw Error("El archivo no es un GLB 2 válido.");
    const doc = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, view.getUint32(12, true))));
    if ([...(doc.buffers || []), ...(doc.images || [])].some(r => r.uri && !r.uri.startsWith("data:"))) throw Error("Exportá un GLB con texturas y geometría embebidas.");
    const manager = new THREE.LoadingManager();
    manager.setURLModifier(url => { if (!/^(blob:|data:)/.test(url)) throw Error("Recurso externo no permitido en la vista previa."); return url; });
    const gltf = await new GLTFLoader(manager).parseAsync(bytes, "");
    if (current !== requestId) { dispose(gltf.scene); return; }
    const bounds = new THREE.Box3().setFromObject(gltf.scene), size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    if (!Number.isFinite(size.y) || size.y < 0.00001) { dispose(gltf.scene); throw Error("El modelo no tiene una altura válida."); }
    if (model) { mixer?.stopAllAction(); mixer?.uncacheRoot(model); scene.remove(model); dispose(model); }
    model = new THREE.Group(); const placement = new THREE.Group(); model.add(placement); placement.add(gltf.scene);
    placement.position.set(-center.x, -bounds.min.y, -center.z); model.scale.setScalar(2.2 / size.y); scene.add(model);
    let triangles = 0, bones = 0, meshes = 0; const materials = new Set();
    gltf.scene.traverse(node => {
      if (node.isBone) bones++;
      if (!node.isMesh) return;
      meshes++; node.castShadow = true; node.receiveShadow = true;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      for (const m of (Array.isArray(node.material) ? node.material : [node.material])) materials.add(m);
    });
    extent = Math.max(2.5, size.x * model.scale.x, size.z * model.scale.z); frame(); wireframe();
    clips = gltf.animations; mixer = new THREE.AnimationMixer(model);
    $("animation").replaceChildren(...(clips.length ? clips.map((clip, i) => new Option(clip.name || `Animación ${i + 1}`, i)) : [new Option("Sin animaciones", "")]));
    $("animation").disabled = $("play").disabled = !clips.length;
    playing = true; $("play").textContent = "Pausar";
    if (clips.length) mixer.clipAction(clips[0]).play();
    $("model-stats").replaceChildren();
    for (const [label, value] of [["Triángulos", Math.round(triangles)], ["Huesos", bones], ["Mallas", meshes], ["Materiales", materials.size], ["Animaciones", clips.length]]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd"); dt.textContent = label; dd.textContent = value; $("model-stats").append(dt, dd);
    }
    status.dataset.state = "ready"; status.textContent = `${file.name} · listo para revisar${triangles > 3000 || bones > 30 ? ". Supera la guía inicial de geometría o huesos; requiere revisión de rendimiento." : "."}`;
  } catch (error) { if (current === requestId) { status.dataset.state = "error"; status.textContent = `No se pudo abrir: ${error.message}`; } }
};
$("open-iron-man").onclick = async () => {
  $("open-iron-man").disabled = true;
  try {
    const response = await fetch(ironManUrl);
    if (!response.ok) throw Error("No se pudo descargar Mark VII.");
    await $("model-file").onchange({ target: { files: [new File([await response.blob()], "Iron-Man-Mark-VII.glb")] } });
  } catch (error) { status.dataset.state = "error"; status.textContent = error.message; }
  finally { $("open-iron-man").disabled = false; }
};
$("animation").onchange = () => { mixer?.stopAllAction(); const clip = clips[Number($("animation").value)]; if (clip) mixer.clipAction(clip).reset().play(); };
$("play").onclick = () => { playing = !playing; $("play").textContent = playing ? "Pausar" : "Reproducir"; };
$("frame").onclick = frame;
$("wireframe").onchange = wireframe;
$("grid").onchange = () => { grid.visible = $("grid").checked; };
let previous = performance.now();
renderer.setAnimationLoop(now => { const dt = Math.min((now - previous) / 1000, 0.1); previous = now; if (playing) mixer?.update(dt); controls.update(); renderer.render(scene, camera); });
