import test from "node:test";
import assert from "node:assert/strict";

const baseUrl = process.env.TEST_BASE_URL || "http://localhost:4000/api";

async function post(path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  return { status: response.status, json };
}

test("booking validate contract shape", async () => {
  const { status, json } = await post("/booking/validate", {
    scheduleAt: "2026-04-08T15:30:00.000Z",
    branchCloseHour: "17:00",
    weekendCloseHour: "16:00"
  });
  assert.equal(status, 200);
  assert.equal(typeof json.valid, "boolean");
  assert.equal(typeof json.reason, "string");
  assert.equal(typeof json.nextAction, "string");
});

test("pickup validate contract shape", async () => {
  const { status, json } = await post("/pickup/validate", { distanceKm: 3.5 });
  assert.equal(status, 200);
  assert.equal(typeof json.inRange, "boolean");
  assert.equal(typeof json.requireHumanValidation, "boolean");
});
