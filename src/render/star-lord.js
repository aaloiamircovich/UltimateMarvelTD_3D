import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { assetEvents } from "./hero-assets.js";
import { shotEnvelope } from "./repulsor-motion.js";

const url = new URL("../../art/models/star-lord-v1/model.glb", import.meta.url).href;
const flashShape = new THREE.SphereGeometry(1, 8, 6);
let pending;

function configureArm(model, frame, side) {
  const name = side === "left" ? "Left" : "Right";
  const arm = model.getObjectByName(name + "Arm");
  const forearm = model.getObjectByName(name + "ForeArm");
  const hand = model.getObjectByName(name + "Hand");
  const muzzle = model.getObjectByName("Muzzle_" + name + "Hand");
  const rest = [arm, forearm, hand].map(bone => bone.quaternion.clone());
  const worldQ = new THREE.Quaternion(), parentQ = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const handBasis = hand.getWorldQuaternion(new THREE.Quaternion());
  const axis = new THREE.Vector3(), end = new THREE.Vector3(), forward = new THREE.Vector3();
  const aim = new THREE.Vector3();
  const flash = new THREE.Mesh(flashShape, new THREE.MeshBasicMaterial({toneMapped:false}));
  flash.scale.setScalar(.025); muzzle.add(flash); flash.visible = false;
  const sign = side === "left" ? 1 : -1;

  function pointBone(bone, child, direction) {
    bone.getWorldPosition(axis); child.getWorldPosition(end);
    axis.subVectors(end, axis).normalize();
    delta.setFromUnitVectors(axis, direction);
    bone.getWorldQuaternion(worldQ).premultiply(delta);
    bone.parent.getWorldQuaternion(parentQ).invert();
    bone.quaternion.copy(parentQ.multiply(worldQ));
    bone.updateWorldMatrix(false,true);
  }
  return { muzzle, update(time, shot, facing, stunned) {
    const age = time - (shot?.time ?? -Infinity);
    const weight = stunned ? 0 : shotEnvelope(age);
    const yaw = (shot?.angle ?? facing) - facing;
    frame.getWorldQuaternion(worldQ);
    forward.set(Math.sin(yaw), 0, Math.cos(yaw));
    arm.quaternion.copy(rest[0]); forearm.quaternion.copy(rest[1]); hand.quaternion.copy(rest[2]);
    arm.updateWorldMatrix(true,true);
    for (const [bone, child, outward, rise] of [[arm,forearm,.27,-.22],[forearm,hand,.10,.06]]) {
      aim.set(sign*outward,-.96,.18).lerp(end.copy(forward).setY(rise),weight).normalize();
      aim.applyQuaternion(frame.getWorldQuaternion(worldQ));
      pointBone(bone,child,aim);
    }
    // The modeled barrels face +Z in the bind pose. Orient the whole wrist
    // after posing the elbow, keeping each barrel on its own shot heading.
    delta.setFromEuler(new THREE.Euler((1-weight)*.94, yaw*weight, 0, "YXZ"));
    frame.getWorldQuaternion(worldQ).multiply(delta).multiply(handBasis);
    hand.parent.getWorldQuaternion(parentQ).invert();
    hand.quaternion.copy(parentQ.multiply(worldQ));
    hand.updateWorldMatrix(false,true);
    flash.visible = !stunned && age >= 0 && age < .10;
    if (flash.visible) {
      flash.material.color.set(shot.color);
      flash.scale.setScalar(.02 + .025*(1-age/.10));
    }
  }};
}

export async function attachStarLord(root) {
  try {
    pending ??= new GLTFLoader().loadAsync(url).catch(error => { pending = null; throw error; });
    const source = await pending;
    if (root.userData.released) return;
    const model = clone(source.scene);
    model.traverse(node => {
      if (node.isSkinnedMesh) { node.skeleton.pose(); node.frustumCulled = false; }
      if (node.isMesh) { node.castShadow = true; node.receiveShadow = true; }
    });
    model.updateMatrixWorld(true);
    const frame = new THREE.Group();
    const bounds = new THREE.Box3().setFromObject(model,true);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z));
    frame.add(model);frame.scale.setScalar(2.4/(bounds.max.y-bounds.min.y));
    frame.updateMatrixWorld(true);
    const arms = { left:configureArm(model,frame,"left"), right:configureArm(model,frame,"right") };
    root.userData.body.clear();root.userData.body.add(frame);
    root.userData.asset = "star-lord-v1";
    root.userData.muzzlePosition = (out = new THREE.Vector3(), side = "right") =>
      (arms[side] ?? arms.right).muzzle.getWorldPosition(out);
    root.userData.animateCombat = (time, _lastShot, stunned, shots) => {
      for (const side of ["left","right"]) arms[side].update(time, shots?.[side], root.rotation.y, stunned);
    };
    root.userData.animateCombat(0);
  } catch {
    assetEvents.dispatchEvent(new CustomEvent("status",{detail:"No se pudo cargar Star-Lord. Se conserva el modelo provisional."}));
  }
}
