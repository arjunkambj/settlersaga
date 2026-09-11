import { describe, expect, test } from "bun:test";

import { chooseBotName } from "../src";

describe("superhero bot names", () => {
  test("does not select a name already used at the table", () => {
    const selectedName = chooseBotName("room:seat:2");

    expect(chooseBotName("room:seat:2", [selectedName])).not.toBe(selectedName);
  });
});
