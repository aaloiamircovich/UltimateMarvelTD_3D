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
    "Browser smoke passed: WebGL, deployment, collision, upgrade, targeting, combat, pause, speed, wave completion, collection, restart, laptop/mobile layouts, dialogs, victory, defeat and profile persistence.",
  );
} finally {
  await browser.close();
  await server.close();
}
