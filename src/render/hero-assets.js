import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { followPose, shotEnvelope } from "./repulsor-motion.js";

const flashGeometry = new THREE.SphereGeometry(1, 12, 8);
const flashMaterial = new THREE.MeshBasicMaterial({ color: "#c9fbff", toneMapped: false });

export const ironManUrl = new URL("../../art/models/iron-man-mark-vii-v1/model.glb", import.meta.url).href;
export const assetEvents = new EventTarget();
let assetPromise;
export function loadIronMan() {
  if (!assetPromise) {
    assetEvents.dispatchEvent(new CustomEvent("status", { detail: "Cargando armadura Mark VII…" }));
    assetPromise = new GLTFLoader().loadAsync(ironManUrl).then(gltf => {
      assetEvents.dispatchEvent(new CustomEvent("status", { detail: "Iron Man Mark VII listo." }));
      return gltf;
    }).catch(error => {
      assetPromise = null;
      assetEvents.dispatchEvent(new CustomEvent("status", { detail: "No se pudo cargar Mark VII. Se conserva el modelo provisional; volvé a seleccionarlo para reintentar." }));
      throw error;
    });
  }
  return assetPromise;
}

// Geometry, textures and materials are shared. SkeletonUtils gives each hero
// independent bones; never dispose shared resources when removing a preview.
export async function attachIronMan(root) {
  try {
    const gltf = await loadIronMan();
    if (root.userData.released) return;
    const model = clone(gltf.scene);
    model.traverse(node => {
      if (node.isSkinnedMesh) { node.skeleton.pose(); node.frustumCulled = false; }
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    model.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model, true);
    const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
    const normalized = new THREE.Group(), placement = new THREE.Group();
    normalized.scale.setScalar(2.4 / size.y);
    placement.position.set(-center.x, -bounds.min.y, -center.z);
    normalized.add(placement); placement.add(model);
    root.userData.body.clear(); root.userData.body.add(normalized);
    root.userData.asset = "iron-man-mark-vii-v1";
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
      hand.localToWorld(out.set(0, 7, 0));
      root.getWorldQuaternion(palmRotation);
      palmNormal.set(0, 0, 1).applyQuaternion(palmRotation);
      return out.addScaledVector(palmNormal, .12 * root.scale.x);
    };
    let aim = 0, previousTime;
    root.userData.animateCombat = (time, lastShotTime, stunned = false) => {
      const elapsed = previousTime === undefined || time < previousTime ? 0 : time - previousTime;
      if (previousTime !== undefined && time < previousTime) aim = 0;
      previousTime = time;
      const age = time - (lastShotTime ?? -Infinity);
      aim = followPose(aim, stunned ? 0 : shotEnvelope(age), elapsed);
      root.userData.updatePose(aim);
      flash.visible = age >= 0 && age < .12 && !stunned;
      if (flash.visible) {
        root.userData.muzzlePosition(palm);
        flash.position.copy(root.worldToLocal(palm));
        flash.scale.setScalar(.07 * (1 - age / .12) + .02);
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
        direction.set(right ? -.12 : .12, -1, .08);
        if (right) direction.lerp(forward, Number(firing));
        direction.normalize().applyQuaternion(orientation);
        bone.parent.getWorldQuaternion(inverse).invert();
        direction.applyQuaternion(inverse);
        bone.quaternion.setFromUnitVectors(up, direction);
        bone.updateWorldMatrix(false, true);
      });
      if (hand) {
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
  root.traverse(node => node.skeleton?.dispose());
  root.removeFromParent();
}
