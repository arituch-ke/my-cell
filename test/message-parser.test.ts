import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMessage, plateLabels } from "../src/message-parser.js";

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

describe("plateLabels", () => {
  it("uses P29-P31 by default", () => {
    assert.deepEqual(plateLabels(false), ["P29", "P30", "P31"]);
  });

  it("increments all labels when Sub is present", () => {
    assert.deepEqual(plateLabels(true), ["P30", "P31", "P32"]);
  });
});
