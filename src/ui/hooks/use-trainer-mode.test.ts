// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTrainerMode } from "./use-trainer-mode";

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

const KEY = "type-review:trainer-mode";

describe("createTrainerMode", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeFakeStorage();
    vi.stubGlobal("localStorage", storage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to mixed when nothing is stored", () => {
    expect(createTrainerMode().mode()).toBe("mixed");
  });

  it("reads stored 'solo'", () => {
    storage.setItem(KEY, "solo");
    expect(createTrainerMode().mode()).toBe("solo");
  });

  it("setMode persists the new value", () => {
    const c = createTrainerMode();
    c.setMode("solo");
    expect(c.mode()).toBe("solo");
    expect(storage.getItem(KEY)).toBe("solo");
  });

  it("falls back to mixed for unrecognised stored values", () => {
    storage.setItem(KEY, "junk");
    expect(createTrainerMode().mode()).toBe("mixed");
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
    const c = createTrainerMode();
    expect(c.mode()).toBe("mixed");
    c.setMode("solo");
    expect(c.mode()).toBe("solo");
  });
});
