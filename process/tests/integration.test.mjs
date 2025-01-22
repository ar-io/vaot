import { describe, it } from "node:test";
import { handle, parseEventsFromResult } from "./helpers.mjs";
import { PROCESS_OWNER, STUB_MESSAGE_ID, STUB_TIMESTAMP } from "../tools/constants.mjs";
import assert from "node:assert";

describe("Integration tests", () => {
  it("should return hello world", async () => {
    const result = await handle({
      options: {
        Tags: [
          { name: "Action", value: "Whatever" }
        ],
      },
    });
    assert.equal(result.Messages?.[0]?.Data, "Hello World");
    const events = parseEventsFromResult(result);
    assert.equal(events.length, 1);
    assert.deepStrictEqual(events[0], {
      "Action": "Whatever",
      "Timestamp": STUB_TIMESTAMP,
      "_e": 1,
      "Message-Id": STUB_MESSAGE_ID,
      "From-Formatted": PROCESS_OWNER,
      "From": PROCESS_OWNER
    });
  });
});
