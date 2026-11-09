import assert from "node:assert/strict";

// Use an isolated formation and renderer; never change the player's collection.
export async function checkCaptainAmerica(page) {
  const result = await page.evaluate(async () => {
    const {CombatGame} = await import('/src/game/combat.js');
    const {toWorld} = await import('/src/game/combat-data.js');
    const {World} = await import('/src/render/world.js');
    const game = new CombatGame('story',{teamIds:['capitan_america','korg']});
    game.core.resourceManager.addCredits(2000);
    const allyCells=[];
    for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('korg',p.x,p.z)) allyCells.push(game.cell(p));
    }
    outer: for(let y=0;y<19;y++) for(let x=0;x<25;x++) {
      const p=toWorld({x:16+32*x,y:16+32*y});
      if(!game.placementError('capitan_america',p.x,p.z) && allyCells.some(a=>Math.hypot(a.x-game.cell(p).x,a.y-game.cell(p).y)>32 && Math.hypot(a.x-game.cell(p).x,a.y-game.cell(p).y)<220)){
        game.deploy('capitan_america',p.x,p.z);break outer;
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
    if(root.userData.asset!=='captain-america-v1') throw Error('Capitán no cargó');
    const free=(near,uid)=>{
      for (let y=0;y<19;y++) for(let x=0;x<25;x++){
        const px=x*32+16,py=y*32+16,p=toWorld({x:px,y:py});
        if ((Math.hypot(px-hero.x,py-hero.y)<255)===near && !game.placementError('korg',p.x,p.z,uid)) return p;
      }
      throw Error('Falta celda legal para el aliado');
    };
    const here=free(true);game.deploy('korg',here.x,here.z);
    const ally=game.core.heroes.find(h=>h.id==='korg');
    const near=ally.getEffectiveStats().damage;
    hero.stunTimer=1;const suspended=ally.getEffectiveStats().damage;hero.stunTimer=0;
    const away=free(false,ally.uid);game.move(ally.uid,away.x,away.z);
    const outside=ally.getEffectiveStats().damage;
    const target=game.spawnEnemy(game.core.enemyDatabase.normal.hydra_soldier);
    hero.shoot(target,hero.getEffectiveStats(),game.core.projectiles);
    const support=game.core.projectiles.length===0;
    game.syncViews();
    const u=game.units[0];
    world.controls.target.set(u.x,.75,u.z);
    world.camera.position.set(u.x+.7,1.85,u.z+4.2);
    world.camera.zoom=5.5;world.camera.updateProjectionMatrix();world.render(game,0);
    window.capReviewCleanup=()=>{world.clear();world.observer.disconnect();world.renderer.dispose();world.renderer.forceContextLoss();host.remove();};
    const head=root.getObjectByName("Head");
    const heights=[];
    for(const time of [0,1,2,4,8]) {
      root.userData.animateCombat(time,0,false);
      root.updateMatrixWorld(true);
      heights.push(head.getWorldPosition(head.position.clone()).y);
    }
    root.userData.animateCombat(0,0,false);
    world.render(game,0);
    return {heights,ratio:near/outside,suspended:suspended===outside,support};
  });
  assert.ok(result.heights.every(y=>y>1 && y<2), "Escala estable durante Guardia: "+JSON.stringify(result.heights));
  assert.ok(Math.abs(result.ratio-1.10)<1e-6,JSON.stringify(result));assert.ok(result.suspended && result.support);
  await page.screenshot({path:'artifacts/cap-combat.png'});
  await page.evaluate(()=>{window.capReviewCleanup();delete window.capReviewCleanup;});
}
