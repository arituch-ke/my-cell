import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { nextPlateNumbers, parseMessage } from "../src/message-parser.js";

describe("parseMessage", () => {
  it("parses Sub and Remark from the screenshot format", () => {
    assert.deepEqual(parseMessage("Sub, Remark=T-75"), { hasSub: true, remark: "T-75" });
  });

  it("accepts colon and case-insensitive fields", () => {
    assert.deepEqual(parseMessage("sub remark: Lot 12"), { hasSub: true, remark: "Lot 12" });
  });

  it("keeps optional fields empty when omitted", () => {
    assert.deepEqual(parseMessage(""), { hasSub: false, remark: null });
  });

  it("does not treat a word containing sub as the Sub flag", () => {
    assert.deepEqual(parseMessage("subject, Remark=OK"), { hasSub: false, remark: "OK" });
  });
});

describe("nextPlateNumbers", () => {
  it("uses 29-31 for the first regular record", () => {
    assert.deepEqual(nextPlateNumbers([], false), [29, 30, 31]);
  });

  it("increments the previous values when Sub is present", () => {
    assert.deepEqual(nextPlateNumbers([30, 31, 32], true), [31, 32, 33]);
  });

  it("keeps the previous values when Sub is absent", () => {
    assert.deepEqual(nextPlateNumbers([30, 31, 32], false), [30, 31, 32]);
  });

  it("migrates legacy P-prefixed values", () => {
    assert.deepEqual(nextPlateNumbers(["P29", "P30", "P31"], true), [30, 31, 32]);
  });
});
