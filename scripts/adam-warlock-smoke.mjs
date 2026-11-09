import assert from "node:assert/strict";

// Use an isolated formation and renderer; never change the player's collection.
export async function checkAdamWarlock(page) {
  const result = await page.evaluate(async () => {
    const {CombatGame} = await import('/src/game/combat.js');
    const {toWorld} = await import('/src/game/combat-data.js');
    const {World} = await import('/src/render/world.js');
    const game = new CombatGame('story',{teamIds:['adam_warlock']});
    game.core.resourceManager.addCredits(2000);
    outer: for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('adam_warlock',p.x,p.z)){
        game.deploy('adam_warlock',p.x,p.z);break outer;
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
    if(root.userData.asset!=='adam-warlock-v1') throw Error('Adam Warlock no cargó');
    const kit=hero.abilitySystem.energyReserveKit;
    kit.update(12);
    const cocoon=kit.pending?.kind==='cocoon';
    const target=game.spawnEnemy({...game.core.enemyDatabase.normal.hydra_soldier,hp:10000});
    target.x=hero.x;target.y=hero.y+70;
    hero.shoot(target,hero.getEffectiveStats(),game.core.projectiles);
    const blocked=game.core.projectiles.length===0;
    kit.update(2);
    game.core.random.next=()=>.99;
    const base=hero.getEffectiveStats().damage;
    const powers=[];
    for(let i=0;i<4;i++){
      hero.shoot(target,hero.getEffectiveStats(),game.core.projectiles);
      powers.push(game.core.projectiles.at(-1).damage/base);
    }
    game.syncViews();world.render(game,0);
    const first=game.projectiles[0];
    const originError=world.projectiles.get(first.id).position.distanceTo(root.userData.muzzlePosition());
    const chain=game.core.projectiles[0].chainCount;
    root.userData.animateCombat(.1,0,false);root.updateMatrixWorld(true);
    const hand=root.getObjectByName('LeftHand');const firing=hand.getWorldPosition(hand.position.clone());
    root.userData.animateCombat(.1,0,false);root.updateMatrixWorld(true);
    const paused=hand.getWorldPosition(hand.position.clone()).distanceTo(firing)<.0001;
    root.userData.animateCombat(2,0,false);root.updateMatrixWorld(true);
    const gesture=hand.getWorldPosition(hand.position.clone()).distanceTo(firing);
    const u=game.units[0];
    game.time=.08;game.syncViews();
    world.controls.target.set(u.x,.75,u.z);
    world.camera.position.set(u.x+3.5,2.2,u.z+2.4);
    world.camera.zoom=7;world.camera.updateProjectionMatrix();world.render(game,0);
    window.adamReviewCleanup=()=>{world.clear();world.observer.disconnect();world.renderer.dispose();world.renderer.forceContextLoss();host.remove();};
    return {cocoon,blocked,powers,originError,chain,paused,gesture};
  });
  assert.ok(result.cocoon && result.blocked && result.paused);
  assert.ok(result.powers.slice(0,3).every(p=>Math.abs(p-1.45)<.00001));
  assert.ok(Math.abs(result.powers[3]-1)<.00001);
  assert.equal(result.chain,2);
  assert.ok(result.originError<.001);
  assert.ok(result.gesture>.03 && result.gesture<2);
  await page.screenshot({path:'artifacts/adam-warlock-combat.png'});
  await page.evaluate(()=>{window.adamReviewCleanup();delete window.adamReviewCleanup;});
}
