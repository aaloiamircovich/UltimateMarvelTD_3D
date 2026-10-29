import test from "node:test";
import assert from "node:assert/strict";
import { assetId, taskId, imageRequest, MeshyClient, modelDownloads, glbDocument } from "../scripts/lib/art-pipeline.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("asset and task names cannot become paths or extra API endpoints", () => {
  assert.equal(assetId("iron-man-v1"), "iron-man-v1");
  for (const invalid of ["../secret", "a/b", "a\\b", "", "x?token=key", "x\n"]) assert.throws(() => assetId(invalid));
  for (const invalid of ["../balance", "abc?x=1", "a/b"]) assert.throws(() => taskId(invalid));
});

test("Meshy API uses fixed host and server-side auth, never echoes provider errors or retries purchases", async () => {
  const calls = [], client = new MeshyClient("test-key-not-real", async (url, options) => {
    calls.push({ url, options }); return { ok: true, json: async () => ({ result: "job-123" }) };
  });
  await client.create("rigging", { input_task_id: "model-123" });
  assert.equal(calls[0].url, "https://api.meshy.ai/openapi/v1/rigging");
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-key-not-real");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.method, "POST");
  let attempts = 0;
  const failing = new MeshyClient("secret", async () => { attempts++; return { ok: false, status: 402, text: async () => "secret" }; });
  await assert.rejects(failing.create("image-to-3d", {}), error => /créditos/.test(error.message) && !error.message.includes("secret"));
  assert.equal(attempts, 1);
  assert.throws(() => client.status("rigging", "../../elsewhere"));
  assert.throws(() => new MeshyClient(""), /MESHY_API_KEY/);
});

test("local reference planning uses the documented generation contract", async () => {
  const folder = await mkdtemp(join(tmpdir(), "marvel-art-"));
  try {
    const file = join(folder, "reference.png"); await writeFile(file, Buffer.from([137,80,78,71,13,10,26,10]));
    const request = await imageRequest(file);
    assert.match(request.image_url, /^data:image\/png;base64,/);
    assert.equal(request.target_polycount, 3000);
    assert.equal(request.pose_mode, "a-pose");
    assert.deepEqual(request.target_formats, ["glb"]);
    await assert.rejects(imageRequest(join(folder, "bad.txt")), /PNG/);
  } finally {
    assert.ok(folder.startsWith(join(tmpdir(), "marvel-art-")));
    await rm(folder, { recursive: true });
  }
});

test("download selection handles absent animations, validates completion and refuses unexpected origins", () => {
  assert.deepEqual(modelDownloads({ status: "SUCCEEDED", result: { rigged_character_glb_url: "https://assets.meshy.ai/x.glb" } }, "rigging"), [{ name: "model", url: "https://assets.meshy.ai/x.glb" }]);
  assert.throws(() => modelDownloads({ status: "PENDING" }, "rigging"), /no está lista/);
  for (const url of ["https://evil.example/a", "http://assets.meshy.ai/a", "https://assets.meshy.ai.evil.example/a", "https://user:pass@assets.meshy.ai/a"]) {
    assert.throws(() => modelDownloads({ status: "SUCCEEDED", model_urls: { glb: url } }, "image-to-3d"), /Origen/);
  }
});

test("GLB validation rejects truncation and external resources before loading a model", () => {
  const pack = document => {
    let text = JSON.stringify(document); text += " ".repeat((4 - Buffer.byteLength(text) % 4) % 4);
    const json = Buffer.from(text), result = Buffer.alloc(20 + json.length);
    result.write("glTF"); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
    result.writeUInt32LE(json.length, 12); result.writeUInt32LE(0x4e4f534a, 16); json.copy(result, 20); return result;
  };
  assert.equal(glbDocument(pack({ asset: { version: "2.0" } })).asset.version, "2.0");
  assert.throws(() => glbDocument(Buffer.from("not a model")), /inválido/);
  assert.throws(() => glbDocument(pack({ images: [{ uri: "https://other.example/texture.png" }] })), /embebidos/);
  const truncated = pack({ asset: { version: "2.0" } }).subarray(0, 22);
  assert.throws(() => glbDocument(truncated), /incompleto/);
});
