// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTrainerStage } from "./use-trainer-stage";

function makeFakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
    removeItem: (k) => {
      data.delete(k);
    },
    clear: () => data.clear(),
    key: (i) => Array.from(data.keys())[i] ?? null,
    get length() {
      return data.size;
    },
  };
}

const KEY = "type-review:trainer-stage";

describe("createTrainerStage", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeFakeStorage();
    vi.stubGlobal("localStorage", storage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to stage 1 when nothing is stored", () => {
    expect(createTrainerStage().stageId()).toBe(1);
  });

  it("reads stored numeric ids", () => {
    storage.setItem(KEY, "5");
    expect(createTrainerStage().stageId()).toBe(5);
  });

  it("setStageId persists the new id", () => {
    const c = createTrainerStage();
    c.setStageId(7);
    expect(c.stageId()).toBe(7);
    expect(storage.getItem(KEY)).toBe("7");
  });

  it("falls back to stage 1 for unknown stored values", () => {
    storage.setItem(KEY, "nonsense");
    expect(createTrainerStage().stageId()).toBe(1);
  });

  it("falls back to stage 1 for out-of-range ids", () => {
    storage.setItem(KEY, "99");
    expect(createTrainerStage().stageId()).toBe(1);
  });

  it("clamps setStageId to the curriculum so a stale UI id can't poison storage", () => {
    const c = createTrainerStage();
    c.setStageId(999);
    expect(c.stageId()).toBe(1);
    expect(storage.getItem(KEY)).toBe("1");
  });

  it("survives a throwing localStorage", () => {
    const throwing: Storage = {
      ...storage,
      getItem: () => {
        throw new Error("ITP private mode");
      },
      setItem: () => {
        throw new Error("quota");
      },
    };
    vi.stubGlobal("localStorage", throwing);
    const c = createTrainerStage();
    expect(c.stageId()).toBe(1);
    c.setStageId(4);
    expect(c.stageId()).toBe(4);
  });
});
