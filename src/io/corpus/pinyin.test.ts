import { describe, expect, it } from "vitest";
import { createPinyinSource } from "./pinyin";

describe("createPinyinSource", () => {
  it("preserves display-only cells like punctuation in entry display metadata", () => {
    const source = createPinyinSource([
      {
        id: "py-ni-hao",
        characters: ["你", "，", "好"],
        pinyin: ["ni", "", "hao"],
        license: "public domain",
      },
    ]);
    const entry = source.pick({ wantedChars: 100, rng: () => 0.5 });
    expect(entry?.text).toBe("ni hao");
    expect(entry?.display).toEqual([
      { start: 0, pinyin: "ni", display: "你" },
      { start: 2, pinyin: "", display: "，" },
      { start: 3, pinyin: "hao", display: "好" },
    ]);
  });

  it("throws on mismatched characters/pinyin lengths", () => {
    expect(() =>
      createPinyinSource([
        {
          id: "py-bad",
          characters: ["你"],
          pinyin: ["ni", "hao"],
          license: "public domain",
        },
      ]),
    ).toThrow(/characters .* pinyin .* must match/i);
  });

  it("throws on mismatched toned/pinyin lengths", () => {
    expect(() =>
      createPinyinSource([
        {
          id: "py-bad-toned",
          characters: ["你"],
          pinyin: ["ni"],
          toned: ["nǐ", "hǎo"],
          license: "public domain",
        },
      ]),
    ).toThrow(/toned .* pinyin .* must match/i);
  });
});
