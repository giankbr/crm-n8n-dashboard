import test from "node:test";
import assert from "node:assert/strict";
import { validateBookingWindow } from "../src/modules/booking/booking.service.js";
import { validatePickup } from "../src/modules/pickup/pickup.service.js";

test("booking weekday cutoff valid before 60 min", () => {
  const date = new Date("2026-04-08T15:30:00");
  const result = validateBookingWindow(date.toISOString(), "17:00", "16:00");
  assert.equal(result.valid, true);
});

test("booking weekday cutoff invalid under 60 min", () => {
  const date = new Date("2026-04-08T16:15:00");
  const result = validateBookingWindow(date.toISOString(), "17:00", "16:00");
  assert.equal(result.valid, false);
  assert.equal(result.reason, "cutoff_exceeded");
});

test("pickup in range no human validation <= 2 km", () => {
  const result = validatePickup(1.5);
  assert.equal(result.inRange, true);
  assert.equal(result.requireHumanValidation, false);
});

test("pickup in range human validation > 2 km", () => {
  const result = validatePickup(3.2);
  assert.equal(result.inRange, true);
  assert.equal(result.requireHumanValidation, true);
});

test("pickup out of range > 7 km", () => {
  const result = validatePickup(9);
  assert.equal(result.inRange, false);
});
