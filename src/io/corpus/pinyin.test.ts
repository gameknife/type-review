import { describe, expect, it } from "vitest";
import type { RawPinyin } from "./pinyin";
import { createPinyinSource } from "./pinyin";

const SAMPLE: RawPinyin[] = [
  {
    id: "py-g1-a",
    characters: ["你", "好"],
    pinyin: ["ni", "hao"],
    license: "public domain",
    grade: 1,
  },
  {
    id: "py-g3-a",
    characters: ["飞", "鸟"],
    pinyin: ["fei", "niao"],
    license: "public domain",
    grade: 3,
  },
  {
    id: "py-g3-b",
    characters: ["月", "亮"],
    pinyin: ["yue", "liang"],
    license: "public domain",
    grade: 3,
  },
];

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

  it("returns any entry when getGrade is 'all'", () => {
    const source = createPinyinSource(SAMPLE, { getGrade: () => "all" });
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const e = source.pick({ wantedChars: 10, rng: () => i / 30 });
      if (e) seen.add(e.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("narrows the pool to the selected grade", () => {
    const source = createPinyinSource(SAMPLE, { getGrade: () => 3 });
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const e = source.pick({ wantedChars: 10, rng: () => i / 30 });
      if (e) seen.add(e.id);
    }
    expect([...seen].every((id) => id.startsWith("py-g3"))).toBe(true);
    expect(seen.size).toBeGreaterThan(0);
  });

  it("re-reads the grade accessor on every pick", () => {
    let grade: "all" | 1 | 3 = 1;
    const source = createPinyinSource(SAMPLE, { getGrade: () => grade });
    expect(source.pick({ wantedChars: 10, rng: () => 0.5 })?.id).toBe("py-g1-a");
    grade = 3;
    const next = source.pick({ wantedChars: 10, rng: () => 0.5 });
    expect(next?.id?.startsWith("py-g3")).toBe(true);
  });

  it("widens back to all entries when the selected grade has no matches", () => {
    const source = createPinyinSource(SAMPLE, { getGrade: () => 6 });
    const e = source.pick({ wantedChars: 10, rng: () => 0.5 });
    expect(e).not.toBeNull();
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
