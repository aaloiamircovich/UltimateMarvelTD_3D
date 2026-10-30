import test from "node:test";
import assert from "node:assert/strict";
import { CombatGame } from "../src/game/combat.js";
import { toWorld } from "../src/game/combat-data.js";

function setup(id) {
  const g=new CombatGame('story',{teamIds:[id]});
  outer:for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
    const p=toWorld({x:x*32+16,y:y*32+16});
    if(!g.placementError(id,p.x,p.z)) {g.deploy(id,p.x,p.z);break outer;}
  }
  const h=g.core.heroes[0];assert.ok(h);
  const e=g.spawnEnemy(g.core.enemyDatabase.normal.hydra_soldier);
  e.x=h.x+20;e.y=h.y;
  h.abilitySystem.fieldDevice.update(8,[e]);g.syncViews();
  assert.equal(g.devices.length,1);
  return {g,h,e,field:h.abilitySystem.fieldDevice};
}
test('Rocket snapshots use original drawn position, independent data and original expiration',()=>{
  const {g,h,field}=setup('rocket_raccoon');
  const v=g.devices[0];assert.deepEqual({x:v.x,z:v.z},toWorld({x:h.x+14,y:h.y+12}));
  assert.deepEqual(v.owner,toWorld(h));assert.equal(v.kind,'turret');
  v.owner.x=999;assert.notEqual(h.x,999);
  g.paused=true;g.update(.2);assert.equal(g.devices[0].life,5);
  field.update(5,[]);g.syncViews();assert.equal(g.devices.length,0);
});
test('Peni arm, trigger and web use original lifecycle without visual feedback changing rules',()=>{
  const {g,h,e,field}=setup('peni_parker');
  assert.equal(g.devices[0].armed,false);
  assert.equal(g.devices[0].triggerRadius,26/32);
  assert.equal(g.devices[0].effectRadius,65/32);
  field.update(1,[]);g.syncViews();assert.equal(g.devices[0].armed,true);
  field.update(.01,[e]);g.syncViews();assert.equal(g.devices.length,0);
  assert.ok(e.debuffs.some(d=>d.type==='web'));
  assert.ok(g.drainEvents().some(e=>e.type==='impact'));
});
test('moving, stunning or withdrawing the owner removes its device through the original system',()=>{
  for(const action of ['move','stun','withdraw']) {
    const {g,h,field}=setup('rocket_raccoon');
    if(action==='move') h.x+=32;
    if(action==='stun') h.stunTimer=1;
    if(action==='withdraw') g.sell(h.uid);
    field.update(.01,[]);g.syncViews();assert.equal(g.devices.length,0);
  }
});
