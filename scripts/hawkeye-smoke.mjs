import assert from "node:assert/strict";

// Use an isolated formation and renderer; never change the player's collection.
export async function checkHawkeye(page) {
  const result = await page.evaluate(async () => {
    const {CombatGame} = await import('/src/game/combat.js');
    const {toWorld} = await import('/src/game/combat-data.js');
    const {World} = await import('/src/render/world.js');
    const game = new CombatGame('story',{teamIds:['hawkeye']});
    game.core.resourceManager.addCredits(2000);
    outer: for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('hawkeye',p.x,p.z)){
        game.deploy('hawkeye',p.x,p.z);break outer;
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
    if(root.userData.asset!=='hawkeye-v1') throw Error('Hawkeye no cargó');
    const target=game.spawnEnemy({...game.core.enemyDatabase.normal.hydra_soldier,hp:10000});
    target.x=hero.x;target.y=hero.y+70;
    game.core.random.next=()=>.99;
    const base=hero.getEffectiveStats().damage;
    const kit=hero.abilitySystem.avengerKit;
    const shots=[];
    for(let i=0;i<4;i++){
      hero.shoot(target,hero.getEffectiveStats(),game.core.projectiles);
      const p=game.core.projectiles.at(-1);
      shots.push({power:p.damage/base,radius:p.splashRadius,style:p.visualStyle});
    }
    game.syncViews();world.render(game,0);
    const first=game.projectiles[0];
    const originError=world.projectiles.get(first.id).position.distanceTo(root.userData.muzzlePosition());
    root.userData.animateCombat(.1,0,false);root.updateMatrixWorld(true);
    const hand=root.getObjectByName('RightHand');const firing=hand.getWorldPosition(hand.position.clone());
    root.userData.animateCombat(.1,0,false);root.updateMatrixWorld(true);
    const paused=hand.getWorldPosition(hand.position.clone()).distanceTo(firing)<.0001;
    root.userData.animateCombat(2,0,false);root.updateMatrixWorld(true);
    const gesture=hand.getWorldPosition(hand.position.clone()).distanceTo(firing);
    let bow;root.traverse(n=>{if(n.isMesh && n.name.includes('Arco'))bow=n;});
    const bowPoint=hand.position.clone();bow.getVertexPosition(0,bowPoint);bowPoint.applyMatrix4(bow.matrixWorld);
    const bowDistance=bowPoint.distanceTo(hand.getWorldPosition(hand.position.clone()));
    const u=game.units[0];
    game.time=.08;game.syncViews();
    world.controls.target.set(u.x,.75,u.z);
    world.camera.position.set(u.x+3.5,2.2,u.z+2.4);
    world.camera.zoom=7;world.camera.updateProjectionMatrix();world.render(game,0);
    window.hawkeyeReviewCleanup=()=>{world.clear();world.observer.disconnect();world.renderer.dispose();world.renderer.forceContextLoss();host.remove();};
    return {shots,originError,paused,gesture,bowDistance};
  });
  assert.ok(result.paused);
  assert.ok(result.bowDistance<1, "Arco unido a la mano también en reposo");
  assert.ok(result.shots.slice(0,3).every(p=>Math.abs(p.power-1)<.00001));
  assert.ok(Math.abs(result.shots[3].power-1.35)<.00001);
  assert.equal(result.shots[3].radius,85);
  assert.ok(result.shots.every(p=>p.style==='arrow'));
  assert.ok(result.originError<.001);
  assert.ok(result.gesture>.03 && result.gesture<2);
  await page.screenshot({path:'artifacts/hawkeye-combat.png'});
  await page.evaluate(()=>{window.hawkeyeReviewCleanup();delete window.hawkeyeReviewCleanup;});
}
