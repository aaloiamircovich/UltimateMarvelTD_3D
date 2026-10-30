import * as THREE from "three";
import { toRules, PIXELS_PER_UNIT } from "../game/combat-data.js";
import { box, cylinder } from "./models.js";
import { isPointInRangePattern } from "../legacy/src/utils/RangePattern.js";

export class DeviceRenderer {
  constructor(scene) { this.scene=scene; this.objects=new Map(); this.pool={mine:[],turret:[]}; }
  create(kind) {
    const root=new THREE.Group(); root.userData.kind=kind;
    const color=kind==='turret'?'#f97316':'#40c9ff';
    cylinder(root,'#17293c',[0,.11,0],[.25,.18,.25]);
    if(kind==='turret') {
      box(root,'#556b82',[0,.35,0],[.27,.4,.27]);
      box(root,color,[0,.6,.05],[.42,.22,.34]);
      box(root,'#c3e5f5',[0,.63,.28],[.12,.12,.38]);
    } else {
      cylinder(root,color,[0,.23,0],[.22,.08,.22]);
      box(root,'#e6faff',[0,.29,0],[.3,.03,.05],true);
      box(root,'#e6faff',[0,.29,0],[.05,.03,.3],true);
    }
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color}));
    lamp.position.set(0,kind==='turret'?.79:.34,0);root.add(lamp);root.userData.lamp=lamp;
    const ringGeometry=new THREE.BufferGeometry();
    ringGeometry.setAttribute("position",new THREE.BufferAttribute(new Float32Array(512*3),3));
    ringGeometry.setDrawRange(0,0);
    const rings=new THREE.LineSegments(ringGeometry,new THREE.LineBasicMaterial({color,transparent:true,opacity:.8}));
    rings.position.y=.03;root.add(rings);root.userData.rings=rings;
    this.scene.add(root); return root;
  }
  update(views, selectedId, time) {
    const active=new Set(views.map(d=>d.id));
    for(const [id,root] of this.objects) if(!active.has(id)) {
      root.visible=false;this.objects.delete(id);this.pool[root.userData.kind].push(root);
    }
    for(const d of views) {
      if(!this.objects.has(d.id)) this.objects.set(d.id,this.pool[d.kind].pop() || this.create(d.kind));
      const root=this.objects.get(d.id);root.visible=true;root.position.set(d.x,.16,d.z);
      root.userData.state=d.label;
      root.userData.lamp.material.color.set(d.armed?'#8fffd1':'#ffc65b');
      root.userData.lamp.scale.setScalar(d.armed ? 1 : .65+.35*(1+Math.sin(time*8))/2);
      const rings=root.userData.rings;
      rings.visible=d.kind==='mine' && selectedId===d.ownerId;
      if(rings.visible) {
        const signature=JSON.stringify([d.x,d.z,d.owner,d.range,d.pattern,d.geometryScale]);
        if(root.userData.signature!==signature) {
          root.userData.signature=signature;
          const points=[];
          for(const radius of [d.triggerRadius,d.effectRadius]) for(let i=0;i<128;i++) {
            const a=new THREE.Vector3(Math.cos(i*Math.PI/64)*radius,0,Math.sin(i*Math.PI/64)*radius);
            const b=new THREE.Vector3(Math.cos((i+1)*Math.PI/64)*radius,0,Math.sin((i+1)*Math.PI/64)*radius);
            const inside=p=>isPointInRangePattern(toRules(d.owner),toRules({x:d.x+p.x,z:d.z+p.z}),d.range*PIXELS_PER_UNIT,d.pattern,d.geometryScale);
            if(inside(a)&&inside(b)) points.push(a,b);
          }
          rings.geometry.setFromPoints(points);rings.geometry.setDrawRange(0,points.length);rings.geometry.computeBoundingSphere();
        }
      }
    }
  }
  clear() { this.update([],null,0); }
  beamOrigin(event) {
    if (!event.from || !event.to) return null;
    for (const root of this.objects.values()) {
      if (root.userData.kind !== 'turret' || Math.hypot(root.position.x-event.from.x,root.position.z-event.from.z)>.001) continue;
      root.rotation.y=Math.atan2(event.to.x-event.from.x,event.to.z-event.from.z);
      root.updateWorldMatrix(true,true);
      return root.localToWorld(new THREE.Vector3(0,.63,.47));
    }
    return null;
  }
}
