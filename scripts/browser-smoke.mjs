import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { ProgressionManager } from "../src/legacy/src/systems/ProgressionManager.js";
import { SOURCE, DEFAULT_TEAM } from "../src/game/combat-data.js";
const collectionKey = "ultimate-marvel-td-collection-v1";

const server = await createServer({
  server: { host: "127.0.0.1", port: 5174, strictPort: true },
});
await server.listen();
const browser = await chromium.launch({
  headless: true,
  args: [
    "--enable-webgl",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
  ],
});
await mkdir("artifacts", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1600, height: 1000 },
  });
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  const missingLegacyAssets = [];
  page.on("response", response => {
    if (response.url().includes("/legacy/") && response.status() >= 400) missingLegacyAssets.push(response.url());
  });
  await page.goto("http://127.0.0.1:5174");
  await page.waitForFunction(
    () =>
      window.__TD?.world,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__TD?.hub && window.__TD.inHub);
  // Exercise a real new profile before loading the explicit combat fixture.
  await page.locator('#hub-squad').click();
  assert.equal(await page.locator('[data-starter]').count(), 3);
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'artifacts/collection-starter-mobile.png'});
  assert.ok(await page.locator('#hub-dialog').evaluate(d => d.scrollWidth <= d.clientWidth));
  await page.locator('[data-starter="black_widow"]').click();
  await page.locator('[data-collection-tab="summon"]').click();
  await page.locator('#recruit-hero').click();
  await page.locator('.recruit-reveal').waitFor();
  let saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), collectionKey);
  assert.equal(saved.unlockedHeroIds.length,2);
  assert.equal(saved.credits,700);
  assert.equal(saved.shop.heroBoxCost,560);
  await page.locator('[data-buy="chaleco_tactico"]').click();
  await page.locator('[data-collection-tab="squad"]').click();
  await page.locator('[data-item-for="black_widow"]').selectOption('chaleco_tactico');
  await page.locator('[data-equip="black_widow"]').click();
  await page.locator('[data-team-slot="1"]').selectOption('');
  await page.locator('#save-team').click();
  await page.screenshot({path:'artifacts/collection-mobile.png'});
  assert.ok(await page.locator('#hub-dialog').evaluate(d => d.scrollWidth <= d.clientWidth));
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1600,height:1000});
  await page.locator('[data-station="story"]').click(); await page.locator('#hub-launch').click();
  assert.equal(await page.locator('.hero-card').count(),1);
  await page.keyboard.press('6'); // Empty roster hotkeys must be harmless.
  await page.locator('[data-hero="black_widow"]').click();
  const starterPoint = await page.evaluate(() => window.__TD.screenPoint(-4,-3.875));
  await page.mouse.click(starterPoint.x,starterPoint.y);
  await page.waitForFunction(() => window.__TD.game.units.length===1);
  assert.equal(await page.evaluate(() => window.__TD.game.core.heroes[0].items[0].id),'chaleco_tactico');
  await page.locator('#upgrade').click(); await page.locator('#priority').click();
  await page.locator('#return-hub').click(); await page.locator('#confirm-hub').click();
  await page.reload(); await page.waitForFunction(() => window.__TD?.hub);
  saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), collectionKey);
  assert.equal(saved.credits,260); assert.equal(saved.heroUpgrades.black_widow.level,2);
  assert.equal(saved.heroTargetPriorities.black_widow,'Último');
  assert.deepEqual(saved.activeTeamIds,['black_widow']);
  await page.locator('#hub-squad').click();
  assert.equal(await page.locator('[data-item-for="black_widow"]').inputValue(),'chaleco_tactico');
  await page.screenshot({path:'artifacts/collection-desktop.png'});
  await page.locator('.collection-save summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#export-collection').click();
  assert.equal((await downloadPromise).suggestedFilename(),'marvel-td-perfil.json');
  const beforeInvalid = await page.evaluate(key => localStorage.getItem(key),collectionKey);
  await page.locator('#import-collection').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await page.getByText(/No se pudo importar:/).waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key),collectionKey),beforeInvalid);
  // A documented 2D profile fixture unlocks the heroes needed for the combat UI checks.
  const fixture = new ProgressionManager(null); fixture.data=structuredClone(SOURCE);
  fixture.state.unlockedHeroIds=[...DEFAULT_TEAM,'scarlet_witch'];
  fixture.state.activeTeamIds=[...DEFAULT_TEAM]; fixture.state.credits=650;
  await page.locator('#import-collection').setInputFiles({name:'combat-fixture.json',mimeType:'application/json',buffer:Buffer.from(fixture.exportSave())});
  await page.locator('#confirm-import').waitFor();
  assert.equal(await page.evaluate(key => localStorage.getItem(key),collectionKey),beforeInvalid,'preview must not overwrite');
  await page.locator('#confirm-import').click();
  assert.equal(await page.evaluate(key => localStorage.getItem(key+'-backup'),collectionKey),beforeInvalid);
  await page.keyboard.press('Escape');
  await page.locator("#hub-archive").click();
  await page.locator("#legacy-search").waitFor();
  assert.equal(await page.locator("#legacy-results").textContent(), "105 resultados");
  const profileBeforeTrial = await page.evaluate(() => JSON.stringify(localStorage));
  await page.locator("#legacy-trial-run").click();
  assert.match(await page.locator("#legacy-trial-result").textContent(), /Ensayo completado.*15 s/);
  const firstTrial = await page.locator("#legacy-trial-result").textContent();
  await page.locator("#legacy-trial-run").click();
  assert.equal(await page.locator("#legacy-trial-result").textContent(), firstTrial);
  await page.locator("#legacy-trial-enemy").selectOption("loki");
  await page.locator("#legacy-trial-run").click();
  assert.match(await page.locator("#legacy-trial-result").textContent(), /Derrota en el ensayo/);
  assert.equal(await page.evaluate(() => JSON.stringify(localStorage)), profileBeforeTrial);
  await page.screenshot({ path: "artifacts/legacy-combat-desktop.png" });
  await page.locator("#legacy-trial-enemy").selectOption("hydra_soldier");
  await page.locator("#legacy-more").click();
  assert.equal(await page.locator(".legacy-card").count(), 48);
  await page.locator("#legacy-team-toggle").click();
  await page.locator("#legacy-search").fill("capitan america");
  await page.locator('[data-entry="capitan_america"]').click();
  await page.locator("#legacy-team-toggle").click();
  await page.locator('[data-tab="synergies"]').click();
  assert.ok(await page.locator(".legacy-active").count() > 0);
  await page.locator('[data-tab="heroes"]').click();
  await page.locator("#legacy-search").fill("spiderman");
  await page.locator('[data-entry="spiderman"]').click();
  await page.locator("#legacy-level").evaluate(input => { input.value = "50"; input.dispatchEvent(new Event("change", { bubbles: true })); });
  assert.equal(await page.locator(".legacy-detail-heading h3").textContent(), "Iron Spider");
  await page.locator("#legacy-item").selectOption("simbionte");
  assert.equal(await page.locator(".legacy-detail-heading h3").textContent(), "Spider-Man Black Suit");
  assert.ok((await page.locator(".legacy-detail-heading img").getAttribute("src")).includes("spiderman_black_suit"));
  await page.locator(".legacy-detail-heading img").evaluate(img => img.decode());
  assert.ok(await page.locator(".legacy-detail-heading img").evaluate(img => img.naturalWidth > 0));
  await page.screenshot({ path: "artifacts/legacy-catalog-desktop.png" });
  await page.locator('[data-tab="items"]').click();
  assert.equal(await page.locator("#legacy-results").textContent(), "82 resultados");
  await page.locator('[data-tab="enemies"]').click();
  assert.equal(await page.locator("#legacy-results").textContent(), "49 resultados");
  await page.locator('[data-tab="levels"]').click();
  assert.equal(await page.locator("#legacy-results").textContent(), "11 resultados");
  await page.locator('[data-tab="heroes"]').click();
  await page.locator("#legacy-rarity").selectOption("Common");
  assert.ok(await page.locator(".legacy-card").count() > 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator("#legacy-search").fill("black_widow");
  await page.locator('[data-entry="black_widow"]').click();
  await page.locator("#legacy-trial-run").click();
  assert.match(await page.locator("#legacy-trial-result").textContent(), /Ensayo completado/);
  await page.screenshot({ path: "artifacts/legacy-combat-mobile.png" });
  await page.locator(".legacy-detail-heading img").evaluate(img => img.decode());
  await page.screenshot({ path: "artifacts/legacy-catalog-mobile.png" });
  assert.ok(await page.locator("#hub-dialog").evaluate(d => d.scrollWidth <= d.clientWidth));
  const closeBox = await page.locator("#hub-close").boundingBox();
  assert.ok(closeBox.y >= 0 && closeBox.y + closeBox.height <= 844);
  await page.locator("#hub-close").click();
  await page.locator("#hub-archive").click();
  await page.locator("#legacy-search").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#hub-dialog").isVisible(), false);
  await page.setViewportSize({ width: 1600, height: 1000 });
  assert.deepEqual(missingLegacyAssets, []);
  await page.screenshot({ path: "artifacts/hub-desktop.png" });
  const startZ = await page.evaluate(() => window.__TD.hub.world.player.position.z);
  await page.locator("#hub-world canvas").focus();
  await page.keyboard.down("w");
  await page.waitForTimeout(400);
  await page.keyboard.up("w");
  assert.ok(await page.evaluate(z => window.__TD.hub.world.player.position.z < z - 0.5, startZ));
  await page.evaluate(() => window.__TD.hub.world.player.position.set(-9, 0, -8));
  await page.waitForFunction(() => window.__TD.hub.world.nearby?.id === "story");
  await page.keyboard.press("e");
  assert.ok(await page.locator("#hub-dialog").isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#hub-dialog").isVisible(), false);
  await page.locator('[data-station="traits"]').click();
  await page.getByText("ZONA EN PREPARACIÓN", { exact: true }).waitFor();
  await page.locator("#hub-close").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/hub-mobile.png" });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const touchZ = await page.evaluate(() => window.__TD.hub.world.player.position.z);
  const touchButton = await page.locator('[data-move="KeyS"]').boundingBox();
  await page.mouse.move(touchButton.x + touchButton.width / 2, touchButton.y + touchButton.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(250);
  await page.mouse.up();
  assert.ok(await page.evaluate(z => window.__TD.hub.world.player.position.z > z, touchZ));
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.locator('[data-station="infinite"]').click();
  await page.locator("#hub-launch").click();
  assert.equal(await page.evaluate(() => window.__TD.game.mode), "infinite");
  assert.equal(await page.evaluate(() => window.__TD.inHub), false);
  await page.locator("#return-hub").click();
  assert.ok(await page.locator("#hub").isVisible());
  await page.locator('[data-station="story"]').click();
  await page.locator("#hub-launch").click();
  await page.screenshot({ path: "artifacts/desktop-initial.png" });
  const pick = async (x, z) => {
    const p = await page.evaluate(([x,z]) => window.__TD.screenPoint(x,z), [x,z]);
    await page.mouse.click(p.x,p.y);
  };
  await page.getByRole("button", { name: "Desplegar Iron Man, despliegue gratis" }).click();
  await pick(-6,-2.875); // Original road cell is blocked.
  assert.equal(await page.evaluate(() => window.__TD.game.units.length),0);
  await pick(-4,-3.875);
  await page.waitForFunction(() => window.__TD.game.units.length===1);
  await page.waitForFunction(() => [...window.__TD.world.units.values()][0]?.userData.asset === "iron-man-mark-vii-v1");
  const modelCheck = await page.evaluate(async () => {
    const { world } = window.__TD, live = [...world.units.values()][0];
    const { heroModel } = await import('/src/render/models.js');
    const { HERO_BY_ID } = await import('/src/game/combat-data.js');
    const { releaseHero, attachIronMan } = await import('/src/render/hero-assets.js');
    const other = heroModel(HERO_BY_ID.iron_man, true, false);
    await attachIronMan(other);
    let a, b; live.traverse(n => { if(n.isSkinnedMesh) a=n; }); other.traverse(n => { if(n.isSkinnedMesh) b=n; });
    const before = a.skeleton.bones.map(n => n.quaternion.toArray());
    other.userData.updatePose(true);
    const result = { bones: a.skeleton.bones.length, triangles: a.geometry.index.count/3,
      sharedGeometry: a.geometry === b.geometry, sharedMaterial: a.material === b.material,
      separateSkeleton: a.skeleton !== b.skeleton,
      unaffected: JSON.stringify(before) === JSON.stringify(a.skeleton.bones.map(n => n.quaternion.toArray())) };
    other.userData.animateCombat(1, 1);
    other.userData.animateCombat(1.1, 1);
    const raised = b.skeleton.bones.map(n => n.quaternion.toArray());
    const muzzle = other.userData.muzzlePosition();
    other.userData.animateCombat(1.1, 1);
    result.pausedPose = JSON.stringify(raised) === JSON.stringify(b.skeleton.bones.map(n => n.quaternion.toArray()));
    result.finiteMuzzle = muzzle.toArray().every(Number.isFinite);
    other.userData.animateCombat(1.8, 1);
    result.recoveredPose = JSON.stringify(raised) !== JSON.stringify(b.skeleton.bones.map(n => n.quaternion.toArray()));
    releaseHero(other);
    world.camera.zoom = 4; world.camera.updateProjectionMatrix(); world.controls.target.copy(live.position);
    return result;
  });
  assert.deepEqual(modelCheck, { bones:24, triangles:3095, sharedGeometry:true, sharedMaterial:true, separateSkeleton:true, unaffected:true, pausedPose:true, finiteMuzzle:true, recoveredPose:true });
  await page.screenshot({path:'artifacts/iron-man-in-combat.png'});
  await page.evaluate(() => { window.__TD.world.resetCamera(); window.__TD.world.resize(); });
  assert.equal(await page.evaluate(() => window.__TD.game.cash),650);
  await page.locator('#upgrade').click();
  assert.equal(await page.evaluate(() => window.__TD.game.units[0].level),2);
  assert.equal(await page.evaluate(() => window.__TD.game.cash),470);
  await page.locator('#priority').click();
  assert.equal(await page.evaluate(() => window.__TD.game.units[0].priority),'Último');
  await page.locator('#move-unit').click();
  await pick(-4,-0.875);
  await page.waitForFunction(() => window.__TD.game.units[0].z===-0.875);
  await page.locator('#sell').click();
  assert.equal(await page.evaluate(() => window.__TD.game.units.length),0);
  assert.equal(await page.evaluate(() => window.__TD.game.cash),470);
  const ids=['iron_man','spiderman','capitan_america','thor','hulk','doctor_strange'];
  for (let i=0;i<ids.length;i++) {
    await page.locator(`[data-hero="${ids[i]}"]`).click();
    await pick(i>3?-3:-4,-3.875+i%4);
    await page.waitForFunction(n => window.__TD.game.units.length===n,i+1);
  }
  assert.equal(await page.evaluate(() => window.__TD.game.units[0].level),2);
  await page.keyboard.press('Escape');
  await page.screenshot({path:'artifacts/combat-deployment.png'});
  await page.locator('#start-wave').click();
  await page.waitForFunction(() => window.__TD.game.enemies.length>0);
  await page.locator('#pause').click();
  const frozen=await page.evaluate(() => window.__TD.game.time);
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__TD.game.time),frozen);
  await page.locator('#pause').click();
  await page.locator('#speed').click();await page.locator('#speed').click();
  assert.equal(await page.evaluate(() => window.__TD.game.speed),3);
  await page.waitForFunction(() => window.__TD.game.units.some(u=>u.damageDealt>0),null,{timeout:30000});
  await page.screenshot({path:'artifacts/combat-action.png'});
  // Advance the real simulation; no modified damage, credits, health or spawn data.
  await page.evaluate(() => {const g=window.__TD.game;for(let i=0;i<12000&&g.phase==='combat';i++)g.update(1/60);});
  await page.waitForFunction(() => window.__TD.game.phase==='preparing');
  assert.equal(await page.evaluate(() => window.__TD.game.completed),1);
  assert.ok(await page.evaluate(() => window.__TD.game.kills>=7));
  await page.locator('#auto').click();
  await page.waitForFunction(() => window.__TD.game.wave===2);
  await page.locator('#auto').click();
  await page.locator('#pause').click();
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-hero="spiderman"]').click();
  await page.screenshot({path:'artifacts/combat-mobile.png'});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
  await page.keyboard.press('Escape');
  const creditsBeforeRestart = await page.evaluate(() => window.__TD.game.cash);
  await page.locator('#settings').click();
  await page.locator('#restart-request').click();
  await page.locator('#restart-confirm-button').click();
  assert.equal(await page.evaluate(() => window.__TD.game.wave),0);
  assert.equal(await page.evaluate(() => window.__TD.game.units.length),0);
  assert.equal(await page.evaluate(() => window.__TD.game.cash),creditsBeforeRestart);
  await page.locator('#return-hub').click();
  await page.locator('#hub-squad').click();
  assert.equal(await page.locator('[data-team-slot="0"] option').count(),8);
  assert.equal(await page.locator('[data-team-slot="0"] option[value="thanos"]').count(),0);
  await page.locator('[data-team-slot="0"]').selectOption('spiderman');
  await page.locator('#save-team').click();
  assert.match(await page.locator('#team-error').textContent(),/diferentes/);
  await page.locator('[data-team-slot="0"]').selectOption('scarlet_witch');
  await page.locator('#save-team').click();
  assert.match(await page.locator('#team-error').textContent(),/listo/);
  await page.keyboard.press('Escape');
  await page.setViewportSize({width:1600,height:1000});
  await page.locator('[data-station="story"]').click();await page.locator('#hub-launch').click();
  await page.locator('[data-hero="scarlet_witch"]').click();await pick(-4,-3.875);
  await page.waitForFunction(() => window.__TD.game.units.length===1);
  assert.equal(await page.evaluate(() => window.__TD.game.units[0].heroId),'scarlet_witch');
  // Explicit end-screen fixture: original final boss, bypass its health only to
  // exercise result UI. This does not claim a balanced level-1 campaign victory.
  await page.evaluate(() => {const g=window.__TD.game;g.core.waveManager.currentWave=100;g.startWave();g.update(1/60);});
  await page.waitForFunction(() => window.__TD.game.enemies.some(e=>e.isBoss));
  await page.screenshot({path:'artifacts/combat-boss.png'});
  assert.match(await page.locator('#boss-hud').textContent(),/Thanos/i);
  await page.evaluate(() => {const g=window.__TD.game;for(const e of g.core.enemies)e.takeDamage(1e12,{ignoreArmor:true});g.update(1/60);g.update(1/60);});
  await page.getByText('La Base Avengers está a salvo.',{exact:true}).waitFor();
  await page.locator('#play-again').click();
  await page.evaluate(() => {const g=window.__TD.game;g.core.waveManager.currentWave=25;g.startWave();g.update(1/60);const boss=g.core.enemies.find(e=>e.isBoss);boss.hasReachedEnd=true;g.update(1/60);});
  await page.getByText('La ciudad volverá a levantarse.',{exact:true}).waitFor();
  assert.equal(await page.evaluate(() => window.__TD.game.health),0);
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ultimate-marvel-td-combat-v2')).victories>=1));
  assert.deepEqual(missingLegacyAssets,[]);
  assert.deepEqual(errors,[]);
  await page.close();
  const recovery = await browser.newPage({viewport:{width:1000,height:800}});
  recovery.on('pageerror', error => errors.push(error.message));
  await recovery.addInitScript(key => localStorage.setItem(key,'{broken'),collectionKey);
  await recovery.goto('http://127.0.0.1:5174');
  await recovery.locator('#hub-squad').click();
  assert.match(await recovery.locator('.collection-error').textContent(),/conserva intacto/);
  await recovery.locator('[data-starter="korg"]').click();
  assert.equal(await recovery.evaluate(key => localStorage.getItem(key),collectionKey),'{broken');
  await recovery.close();
  assert.deepEqual(errors,[]);
  console.log('Browser smoke passed: archive, HUB, persistent collection, recruitment, equipment, validated 2D import, export, owned-hero team selection, original terrain/placement/upgrade/reposition/withdrawal, projectiles, real wave rewards, pause/speed/auto, mobile layout, bosses, terminal fixtures and isolated records.');
} finally {
  await browser.close();
  await server.close();
}
