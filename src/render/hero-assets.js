import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { followPose, shotEnvelope } from "./repulsor-motion.js";
import { attachTorchFlames } from "./torch-flames.js";

const flashGeometry = new THREE.SphereGeometry(1, 12, 8);
const flashMaterial = new THREE.MeshBasicMaterial({ color: "#c9fbff", toneMapped: false });

export const ironManUrl = new URL("../../art/models/iron-man-mark-vii-v1/model.glb", import.meta.url).href;
export const assetEvents = new EventTarget();
const markVII = { id: "iron-man-mark-vii-v1", name: "Iron Man Mark VII", url: ironManUrl };
const spiderMan = { id: "spiderman-v1", name: "Spider-Man",
  url: new URL("../../art/models/spiderman-v1/model.glb", import.meta.url).href };
const pending = new Map();
function loadAsset(asset) {
  if (!pending.has(asset.id)) {
    assetEvents.dispatchEvent(new CustomEvent("status", { detail: `Cargando ${asset.name}…` }));
    pending.set(asset.id, new GLTFLoader().loadAsync(asset.url).then(gltf => {
      assetEvents.dispatchEvent(new CustomEvent("status", { detail: `${asset.name} listo.` }));
      return gltf;
    }).catch(error => {
      pending.delete(asset.id);
      assetEvents.dispatchEvent(new CustomEvent("status", { detail: `No se pudo cargar ${asset.name}. Volvé a seleccionarlo para reintentar.` }));
      throw error;
    }));
  }
  return pending.get(asset.id);
}

export const loadIronMan = () => loadAsset(markVII);
export const attachIronMan = root => attachWristShooter(root, markVII);
export const attachSpiderMan = root => attachWristShooter(root, spiderMan);

function mountCharacter(root, gltf, asset, height, initializePose) {
  const model = clone(gltf.scene);
  model.traverse(node => {
    if (node.isSkinnedMesh) { node.skeleton.pose(); node.frustumCulled = false; }
    if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
  });
  // Animated assets must be measured in their displayed pose, including root transforms.
  initializePose?.(model);
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(model, true);
  const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
  const normalized = new THREE.Group(), placement = new THREE.Group();
  normalized.scale.setScalar(height / size.y);
  placement.position.set(-center.x, -bounds.min.y, -center.z);
  normalized.add(placement); placement.add(model);
  root.userData.body.clear(); root.userData.body.add(normalized);
  root.userData.asset = asset.id;
  return model;
}

const reedAsset = { id: "mister-fantastic-v1", name: "Mr. Fantastic",
  url: new URL("../../art/models/mister-fantastic-v1/model.glb", import.meta.url).href };

const sueAsset = { id: "invisible-woman-v1", name: "Invisible Woman",
  url: new URL("../../art/models/invisible-woman-v1/model.glb", import.meta.url).href };

const captainAsset = { id: "captain-america-v1", name: "Capitán América",
  url: new URL("../../art/models/captain-america-v1/model.glb", import.meta.url).href };

export const attachMisterFantastic = root => attachSupportGuard(root, reedAsset, 2.43);
export const attachInvisibleWoman = root => attachSupportGuard(root, sueAsset, 2.36);
export const attachCaptainAmerica = root => attachSupportGuard(root, captainAsset, 2.50);

async function attachSupportGuard(root, asset, height) {
  try {
    const gltf = await loadAsset(asset);
    if (root.userData.released) return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, "Guardia");
    let mixer;
    mountCharacter(root, gltf, asset, height, model => {
      if (!clip) return;
      mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(clip).play();
      mixer.setTime(0);
    });
    root.userData.body.scale.setScalar(1);
    if (mixer) {
      root.userData.animateCombat = (time, _shot, stunned) => mixer.setTime(stunned ? 0 : time % clip.duration);
    }
  } catch { /* loadAsset informa el error mientras se mantiene el modelo provisional. */ }
}

const hulkAsset = { id: "hulk-v1", name: "Hulk",
  url: new URL("../../art/models/hulk-v1/model.glb", import.meta.url).href };

const torchAsset = { id: "human-torch-v1", name: "Human Torch",
  url: new URL("../../art/models/human-torch-v1/model.glb", import.meta.url).href };

export async function attachHumanTorch(root) {
  try {
    const gltf = await loadAsset(torchAsset);
    if (root.userData.released) return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, "Lanzamiento");
    let mixer, action;
    const model = mountCharacter(root, gltf, torchAsset, 2.43, model => {
      mixer = new THREE.AnimationMixer(model);
      action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
      action.play(); action.paused = true; action.time = clip.duration;
      mixer.update(0);
    });
    root.userData.body.scale.setScalar(1);
    const hand = model.getObjectByName("RightHand");
    root.userData.muzzlePosition = (out = new THREE.Vector3()) => {
      root.updateWorldMatrix(true, true);
      return hand.getWorldPosition(out);
    };
    const flames = attachTorchFlames(root, model);
    root.userData.animateCombat = (time, lastShot, stunned) => {
      const age = time - (lastShot ?? -Infinity);
      action.time = !stunned && age >= 0 && age < clip.duration ? age : clip.duration;
      mixer.update(0);
      flames(time, shotEnvelope(age), stunned);
    };
    root.userData.animateCombat(0, -Infinity, false);
  } catch { /* El modelo provisional y el aviso de carga siguen disponibles. */ }
}

const thorAsset = { id: "thor-v1", name: "Thor",
  url: new URL("../../art/models/thor-v1/model.glb", import.meta.url).href };

const adamAsset = { id: "adam-warlock-v1", name: "Adam Warlock",
  url: new URL("../../art/models/adam-warlock-v1/model.glb", import.meta.url).href };

export async function attachAdamWarlock(root) {
  try {
    const gltf = await loadAsset(adamAsset);
    if (root.userData.released) return;
    const clip = THREE.AnimationClip.findByName(gltf.animations, "Canalizacion");
    let mixer, action;
    const model = mountCharacter(root, gltf, adamAsset, 2.55, model => {
      mixer = new THREE.AnimationMixer(model); action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1); action.clampWhenFinished = true;
      action.play(); action.paused = true; action.time = clip.duration; mixer.update(0);
    });
    root.userData.body.scale.setScalar(1);
    const hand = model.getObjectByName("LeftHand");
    root.userData.muzzlePosition = (out = new THREE.Vector3()) => {
      root.updateWorldMatrix(true, true); return hand.getWorldPosition(out);
    };
    root.userData.animateCombat = (time, lastShot, stunned) => {
      const age = time - (lastShot ?? -Infinity);
      action.time = !stunned && age >= 0 && age < clip.duration ? age : clip.duration;
      mixer.update(0);
    };
  } catch { /* Se mantiene la figura provisional si falla la carga. */ }
}

export const attachHulk = root => attachAnimatedAttacker(root, hulkAsset, 3.05, "Golpe");
export const attachThor = root => attachAnimatedAttacker(root, thorAsset, 2.55, "Descarga");

async function attachAnimatedAttacker(root, asset, height, animation) {
  try {
    const gltf = await loadAsset(asset);
    if (root.userData.released) return;
    const model = mountCharacter(root, gltf, asset, height);
    root.userData.body.scale.setScalar(1);
    const emitter = model.getObjectByName("Mjolnir");
    if (emitter) root.userData.muzzlePosition = (out = new THREE.Vector3()) => emitter.getWorldPosition(out);
    const clip = THREE.AnimationClip.findByName(gltf.animations, animation);
    const mixer = new THREE.AnimationMixer(model);
    const action = mixer.clipAction(clip);
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.play();
    action.paused = true;
    root.userData.animateCombat = (time, lastShot, stunned) => {
      const age = time - (lastShot ?? -Infinity);
      action.time = !stunned && age >= 0 && age < clip.duration ? age : 0;
      mixer.update(0);
    };
  } catch { /* El aviso de carga mantiene disponible el modelo provisional. */ }
}

// Both rigs fire from the right arm. Cloned skeletons keep poses independent.
async function attachWristShooter(root, asset) {
  try {
    const gltf = await loadAsset(asset);
    const web = asset === spiderMan;
    if (root.userData.released) return;
    const model = mountCharacter(root, gltf, asset, 2.4);
    const arms = ["LeftArm", "RightArm", "LeftForeArm", "RightForeArm"].map(name => model.getObjectByName(name));
    const up = new THREE.Vector3(0, 1, 0), inverse = new THREE.Quaternion();
    const forward = new THREE.Vector3(0, 0, 1);
    const direction = new THREE.Vector3(), orientation = new THREE.Quaternion();
    const hand = model.getObjectByName("RightHand");
    const handRest = hand?.quaternion.clone();
    const wristTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    const wrist = new THREE.Quaternion();
    const palm = new THREE.Vector3(), palmNormal = new THREE.Vector3();
    const palmRotation = new THREE.Quaternion();
    const flash = new THREE.Mesh(flashGeometry, flashMaterial);
    flash.visible = false; root.add(flash);
    root.userData.muzzlePosition = (out = new THREE.Vector3()) => {
      root.updateWorldMatrix(true, true);
      if (!hand) return root.getWorldPosition(out);
      hand.localToWorld(out.set(0, web ? 0 : 7, 0));
      root.getWorldQuaternion(palmRotation);
      palmNormal.set(0, 0, 1).applyQuaternion(palmRotation);
      return out.addScaledVector(palmNormal, (web ? .015 : .12) * root.scale.x);
    };
    let aim = 0, previousTime;
    root.userData.animateCombat = (time, lastShotTime, stunned = false) => {
      const elapsed = previousTime === undefined || time < previousTime ? 0 : time - previousTime;
      if (previousTime !== undefined && time < previousTime) aim = 0;
      previousTime = time;
      const age = time - (lastShotTime ?? -Infinity);
      aim = web && !stunned && age >= 0 && age < .12 ? 1 : followPose(aim, stunned ? 0 : shotEnvelope(age), elapsed);
      root.userData.updatePose(aim);
      flash.visible = age >= 0 && age < .12 && !stunned;
      if (flash.visible) {
        root.userData.muzzlePosition(palm);
        flash.position.copy(root.worldToLocal(palm));
        if (web) {
          const length = .22 * (1 - age / .12);
          flash.position.z += length;
          flash.scale.set(.013, .013, length);
        } else flash.scale.setScalar(.07 * (1 - age / .12) + .02);
      }
    };
    root.userData.updatePose = firing => {
      // Aim each bone's local Y axis in model space, then convert to parent space.
      // This is a presentation-only pose; original projectile timing owns damage.
      model.updateWorldMatrix(true, true);
      model.getWorldQuaternion(orientation);
      arms.forEach((bone, i) => {
        if (!bone) return;
        const right = i % 2 === 1;
        if (web && !right) direction.set(.40, i === 0 ? -.85 : -.24, i === 0 ? -.22 : .84);
        else direction.set(right ? -.12 : .12, -1, .08);
        if (right) direction.lerp(forward, Number(firing));
        direction.normalize().applyQuaternion(orientation);
        bone.parent.getWorldQuaternion(inverse).invert();
        direction.applyQuaternion(inverse);
        bone.quaternion.setFromUnitVectors(up, direction);
        bone.updateWorldMatrix(false, true);
      });
      if (hand && web && firing > 0) {
        direction.set(-.15, .30, 1).normalize().applyQuaternion(orientation);
        hand.parent.getWorldQuaternion(inverse).invert();
        const target = wrist.setFromUnitVectors(up, direction.applyQuaternion(inverse));
        hand.quaternion.copy(handRest).slerp(target, Number(firing));
        hand.updateWorldMatrix(false,true);
      } else if (hand) {
        wrist.identity().slerp(wristTurn, Number(firing));
        hand.quaternion.copy(handRest).multiply(wrist);
        hand.updateWorldMatrix(false, true);
      }
    };
    root.userData.updatePose(false);
  } catch { /* Visible status and the procedural fallback remain available. */ }
}

export function releaseHero(root) {
  root.userData.released = true;
  root.userData.disposeEffects?.();
  root.traverse(node => node.skeleton?.dispose());
  root.removeFromParent();
}
