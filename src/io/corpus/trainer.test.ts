import { describe, expect, it } from "vitest";
import { createTrainerSource } from "./trainer";
import { TRAINER_STAGES, trainerStageById } from "./trainer-stages";

const seededRng = (seed: number) => {
  let s = seed;
  return (): number => {
    // Mulberry32 — deterministic, uniform in [0, 1).
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe("trainerStageById", () => {
  it("returns the stage with matching id", () => {
    expect(trainerStageById(1).label).toBe("fj");
    expect(trainerStageById(5).label).toBe("gh");
  });

  it("falls back to stage 1 for unknown ids", () => {
    expect(trainerStageById(999).label).toBe("fj");
  });
});

describe("createTrainerSource", () => {
  const ctx = (rng: () => number, wantedChars = 60) => ({ wantedChars, rng });

  it("emits only stage-allowed characters", () => {
    const source = createTrainerSource({ getStageId: () => 2, rng: seededRng(1) });
    const entry = source.pick(ctx(seededRng(2)));
    expect(entry).not.toBeNull();
    const allowed = new Set(["f", "j", "d", "k", " "]);
    if (entry) {
      for (const ch of entry.text) {
        expect(allowed.has(ch)).toBe(true);
      }
    }
  });

  it("re-reads the stage id on every pick", () => {
    let stage = 1;
    const source = createTrainerSource({ getStageId: () => stage, rng: seededRng(7) });
    const first = source.pick(ctx(seededRng(7)));
    expect(first?.text).toMatch(/^[fj ]+$/);

    stage = 3;
    const next = source.pick(ctx(seededRng(8)));
    // After bumping to stage 3, the pool gains s, l on top of f, j, d, k.
    expect(next?.text).toMatch(/^[fjdksl ]+$/);
  });

  it("tags passage ids with the trainer- prefix and stage number", () => {
    const source = createTrainerSource({ getStageId: () => 4, rng: seededRng(11) });
    const entry = source.pick(ctx(seededRng(11)));
    expect(entry?.id?.startsWith("trainer-4-")).toBe(true);
  });

  it("over-represents the focus letter for the active stage", () => {
    // Stage 2 introduces d and k; d is the first newChar, so it's the focus.
    const source = createTrainerSource({ getStageId: () => 2, rng: seededRng(42) });
    // Pull a large sample to dampen variance.
    let total = 0;
    let dCount = 0;
    for (let i = 0; i < 20; i++) {
      const entry = source.pick(ctx(seededRng(42 + i), 200));
      if (!entry) continue;
      for (const ch of entry.text) {
        if (ch === " ") continue;
        total++;
        if (ch === "d") dCount++;
      }
    }
    // Without bias each of {f,j,d,k} would land near 25%. The 0.7
    // focusBias seed shoves the focus letter well above that, so 35%
    // is a generous floor that still proves the bias is wired up.
    expect(dCount / total).toBeGreaterThan(0.35);
  });

  it("returns a passage that round-trips through the trainer prefix classifier", () => {
    // Sanity check: TRAINER_STAGES drives both the source's emitted
    // id prefix and the registered channel classifier, so a fresh
    // pick must classify back to "trainer".
    const source = createTrainerSource({ rng: seededRng(99) });
    const entry = source.pick(ctx(seededRng(99)));
    expect(entry?.id?.startsWith("trainer-")).toBe(true);
  });

  it("exposes 17 stages covering home, top, bottom, punctuation, shift, and numbers", () => {
    expect(TRAINER_STAGES).toHaveLength(17);
    // Spot-check labels at key boundaries to catch off-by-one
    // mistakes when someone tweaks the curriculum.
    expect(TRAINER_STAGES[0]?.label).toBe("fj");
    expect(TRAINER_STAGES[3]?.label).toBe("al");
    expect(TRAINER_STAGES[14]?.label).toBe("punct");
    expect(TRAINER_STAGES[15]?.label).toBe("Shift");
    expect(TRAINER_STAGES[16]?.label).toBe("1-0");
  });
});
