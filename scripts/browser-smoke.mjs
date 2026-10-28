import { chromium } from "@playwright/test";
import { createServer } from "vite";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";

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
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:5174");
  await page.waitForFunction(
    () =>
      window.__TD?.world &&
      document.querySelectorAll(".hero-card").length === 6,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__TD?.hub && window.__TD.inHub);
  const missingLegacyAssets = [];
  page.on("response", response => {
    if (response.url().includes("/legacy/") && response.status() >= 400) missingLegacyAssets.push(response.url());
  });
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
    const p = await page.evaluate(
      ([x, z]) => window.__TD.screenPoint(x, z),
      [x, z],
    );
    await page.mouse.click(p.x, p.y);
  };
  await page
    .getByRole("button", { name: "Desplegar Iron Man, 300 créditos" })
    .click();
  await pick(-9, 1);
  assert.equal(await page.evaluate(() => window.__TD.game.units.length), 0);
  await pick(-6, -1);
  await page.waitForFunction(() => window.__TD.game.units.length === 1);
  assert.equal(await page.evaluate(() => window.__TD.game.cash), 700);
  await page.locator("#upgrade").click();
  assert.equal(await page.evaluate(() => window.__TD.game.units[0].level), 2);
  await page.locator("#priority").click();
  assert.equal(
    await page.evaluate(() => window.__TD.game.units[0].priority),
    "Último",
  );
  await page
    .getByRole("button", { name: "Desplegar Spider-Man, 225 créditos" })
    .click();
  await pick(-6, 3);
  await page.waitForFunction(() => window.__TD.game.units.length === 2);
  await page.locator("#start-wave").click();
  await page.waitForFunction(() => window.__TD.game.enemies.length > 0);
  await page.locator("#pause").click();
  const before = await page.evaluate(() => window.__TD.game.time);
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(() => window.__TD.game.time), before);
  await page.locator("#pause").click();
  await page.locator("#speed").click();
  await page.locator("#speed").click();
  assert.equal(await page.evaluate(() => window.__TD.game.speed), 3);
  await page.screenshot({ path: "artifacts/desktop-combat.png" });
  await page.waitForFunction(
    () => window.__TD.game.phase === "preparing" && window.__TD.game.wave === 1,
    null,
    { timeout: 60000 },
  );
  assert.ok(await page.evaluate(() => window.__TD.game.kills > 0));
  await page.locator("#collection").click();
  assert.equal(await page.locator(".collection-grid article").count(), 6);
  await page.locator("#close-modal").click();
  await page.locator("#settings").click();
  await page.locator("#restart-request").click();
  await page.locator("#restart-confirm-button").click();
  assert.equal(await page.evaluate(() => window.__TD.game.wave), 0);
  assert.equal(await page.evaluate(() => window.__TD.game.units.length), 0);
  assert.equal(await page.evaluate(() => window.__TD.game.cash), 1000);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.screenshot({ path: "artifacts/laptop.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/mobile.png" });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page
    .getByRole("button", { name: "Desplegar Iron Man, 300 créditos" })
    .click();
  assert.ok(await page.locator("#cancel-placement").isVisible());
  await page.screenshot({ path: "artifacts/mobile-selection.png" });
  await page.locator("#cancel-placement").click();
  await page.locator("#help").click();
  assert.ok(await page.locator("#modal").isVisible());
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#modal").isVisible(), false);
  // Drive the public simulation API through complete matches, then let the real
  // animation loop consume terminal events and render/persist the results.
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => {
    const g = window.__TD.game;
    const plan = [
      ["iron_man", -6, -1],
      ["spiderman", -6, 3],
      ["thor", 1, 1],
      ["capitan_america", -4, 2],
      ["hulk", 5, 1],
      ["iron_man", 4, -4],
      ["doctor_strange", 10, -3],
    ];
    let index = 0;
    for (let wave = 1; wave <= 12; wave++) {
      while (index < plan.length) {
        const result = g.deploy(...plan[index]);
        if (result.error) break;
        index++;
      }
      for (const u of g.units.filter((u) => u.heroId !== "capitan_america"))
        if (index >= 4 || wave > 3) g.upgrade(u.id);
      g.startWave();
      let ticks = 0;
      while (g.phase === "combat" && ticks++ < 6000) {
        g.update(1 / 30);
        if (g.phase !== "victory" && g.phase !== "defeat") g.drainEvents();
      }
      if (g.phase === "defeat") throw Error("Winning strategy failed");
    }
  });
  await page.getByText("Manhattan está a salvo.", { exact: true }).waitFor();
  await page.screenshot({ path: "artifacts/victory.png" });
  assert.ok(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("ultimate-marvel-td-profile-v1"))
          .victories >= 1,
    ),
  );
  await page.locator("#play-again").click();
  await page.evaluate(() => {
    const g = window.__TD.game;
    g.auto = true;
    g.startWave();
    for (let i = 0; i < 15000 && g.phase !== "defeat"; i++) {
      g.update(1 / 30);
      if (g.phase !== "defeat") g.drainEvents();
    }
  });
  await page
    .getByText("La ciudad volverá a levantarse.", { exact: true })
    .waitFor();
  await page.locator("#play-again").click();
  assert.equal(await page.evaluate(() => window.__TD.game.phase), "preparing");
  assert.deepEqual(errors, []);
  console.log(
    "Browser smoke passed: original catalogue, search, rarity, level/equipment previews, evolution portraits, synergies, maps/enemies/items, desktop/mobile dialogs; WebGL, HUB, deployment, combat, victory, defeat and persistence.",
  );
} finally {
  await browser.close();
  await server.close();
}
