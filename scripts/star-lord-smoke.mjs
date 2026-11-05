import assert from "node:assert/strict";

// Use an isolated formation and renderer; never change the player's collection.
export async function checkStarLord(page) {
  const result = await page.evaluate(async () => {
    const {CombatGame} = await import('/src/game/combat.js');
    const {toWorld} = await import('/src/game/combat-data.js');
    const {World} = await import('/src/render/world.js');
    const game = new CombatGame('story',{teamIds:['star_lord']});
    outer: for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('star_lord',p.x,p.z)){
        game.deploy('star_lord',p.x,p.z);break outer;
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
    if(root.userData.asset!=='star-lord-v1') throw Error('Star-Lord no cargó');
    const spawn=(dx,dy)=>{
      const e=game.spawnEnemy(game.core.enemyDatabase.normal.hydra_soldier);
      e.x=hero.x+dx;e.y=hero.y+dy;return e;
    };
    const fire=target=>{hero.shoot(target,hero.getEffectiveStats(),game.core.projectiles);game.syncViews();world.render(game,0);};
    const primary=spawn(0,70);
    hero.abilitySystem.cosmicKit.blasterCooldown=0;
    fire(primary);
    const single=game.projectiles.map(p=>p.blasterSide);
    spawn(32,65);game.time+=1;fire(primary);
    const double=game.projectiles.slice(-2);
    const errors=double.map(p=>{
      const spawnPoint=root.userData.muzzlePosition(undefined,p.blasterSide);
      return world.projectiles.get(p.id).position.distanceTo(spawnPoint);
    });
    const span=root.userData.muzzlePosition(undefined,'left').distanceTo(root.userData.muzzlePosition(undefined,'right'));
    const u=game.units[0];
    game.update(.08);
    world.controls.target.set(u.x,.75,u.z);
    world.camera.position.set(u.x+3.5,2.2,u.z+2.4);
    world.camera.zoom=7;world.camera.updateProjectionMatrix();world.render(game,0);
    window.starLordReviewCleanup=()=>{world.clear();world.observer.disconnect();world.renderer.dispose();world.renderer.forceContextLoss();host.remove();};
    return {single,double:double.map(p=>p.blasterSide),errors,span};
  });
  assert.deepEqual(result.single,['right']);
  assert.deepEqual(result.double,['right','left']);
  assert.ok(result.errors.every(e=>e<.001));
  assert.ok(result.span>.1 && result.span<2);
  await page.screenshot({path:'artifacts/star-lord-combat.png'});
  await page.evaluate(()=>{window.starLordReviewCleanup();delete window.starLordReviewCleanup;});
}
