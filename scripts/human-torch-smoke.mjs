import assert from "node:assert/strict";

// Use an isolated formation and renderer; never change the player's collection.
export async function checkHumanTorch(page) {
  const result = await page.evaluate(async () => {
    const {CombatGame} = await import('/src/game/combat.js');
    const {toWorld} = await import('/src/game/combat-data.js');
    const {World} = await import('/src/render/world.js');
    const game = new CombatGame('story',{teamIds:['human_torch']});
    outer: for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('human_torch',p.x,p.z)){
        game.deploy('human_torch',p.x,p.z);break outer;
      }
    }
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    const host=document.createElement('div');
    Object.assign(host.style,{position:'fixed',inset:'0',zIndex:20000});document.body.append(host);
    const world=new World(host,()=>{},()=>{});
    const hero=game.core.heroes[0];
    world.render(game,0);
    const root=world.units.get(hero.uid);
    const deadline=performance.now()+15000;
    while(!root.userData.asset && performance.now()<deadline) await new Promise(requestAnimationFrame);
    if(root.userData.asset!=='human-torch-v1') throw Error('Human Torch no cargó');
    const targets=Array.from({length:5},(_,i)=>{
      const e=game.spawnEnemy({...game.core.enemyDatabase.normal.hydra_soldier,hp:10000,category:hero.category});
      e.x=hero.x+i*2;e.y=hero.y+70;return e;
    });
    const durability=targets.map(e=>e.hp+e.behavior.barrier);
    const kit=hero.abilitySystem.darkfireKit;
    kit.update(7);
    hero.shoot(targets[0],hero.getEffectiveStats(),game.core.projectiles);
    game.syncViews();world.render(game,0);
    const shot=game.projectiles[0];
    const originError=world.projectiles.get(shot.id).position.distanceTo(root.userData.muzzlePosition());
    const damage=kit.zone.damage;
    kit.update(2.9);const early=targets.every(e=>e.hp===e.maxHp);
    kit.update(.11);const damageTaken=targets.map((e,i)=>durability[i]-e.hp-e.behavior.barrier);
    root.userData.animateCombat(.2,0,false);root.updateMatrixWorld(true);
    const hand=root.getObjectByName('RightHand');const firing=hand.getWorldPosition(hand.position.clone());
    const clock=root.userData.flameMaterial.uniforms.time.value;
    root.userData.animateCombat(.2,0,false);
    const paused=root.userData.flameMaterial.uniforms.time.value===clock && hand.getWorldPosition(hand.position.clone()).distanceTo(firing)<.0001;
    root.userData.animateCombat(2,0,false);root.updateMatrixWorld(true);
    const gesture=hand.getWorldPosition(hand.position.clone()).distanceTo(firing);
    const flames=root.children.filter(n=>n.name.startsWith('Llama_')).length;
    const u=game.units[0];
    game.time=.08;game.syncViews();
    world.controls.target.set(u.x,.75,u.z);
    world.camera.position.set(u.x+3.5,2.2,u.z+2.4);
    world.camera.zoom=7;world.camera.updateProjectionMatrix();world.render(game,0);
    window.torchReviewCleanup=()=>{world.clear();world.observer.disconnect();world.renderer.dispose();world.renderer.forceContextLoss();host.remove();};
    return {originError,early,damage,damageTaken,paused,gesture,flames};
  });
  assert.ok(result.originError<.001,"Proyectil desde la mano");
  assert.ok(result.early && result.paused);
  assert.ok(result.damageTaken.slice(0,4).every(d=>Math.abs(d-result.damage)<.001));
  assert.equal(result.damageTaken[4],0);
  assert.equal(result.flames,5);
  assert.ok(result.gesture>.05 && result.gesture<2,"Gesto de lanzamiento visible y escala estable");
  await page.screenshot({path:'artifacts/human-torch-combat.png'});
  await page.evaluate(()=>{window.torchReviewCleanup();delete window.torchReviewCleanup;});
}
