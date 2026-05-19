// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPinyinGrade } from "./use-pinyin-grade";

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

const KEY = "type-review:pinyin-grade";

describe("createPinyinGrade", () => {
  let storage: Storage;
  beforeEach(() => {
    storage = makeFakeStorage();
    vi.stubGlobal("localStorage", storage);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults to 'all' when nothing is stored", () => {
    expect(createPinyinGrade().grade()).toBe("all");
  });

  it("reads valid numeric grades", () => {
    storage.setItem(KEY, "3");
    expect(createPinyinGrade().grade()).toBe(3);
  });

  it("setGrade persists numeric grades as strings", () => {
    const g = createPinyinGrade();
    g.setGrade(6);
    expect(g.grade()).toBe(6);
    expect(storage.getItem(KEY)).toBe("6");
  });

  it("setGrade('all') persists 'all'", () => {
    const g = createPinyinGrade();
    g.setGrade("all");
    expect(g.grade()).toBe("all");
    expect(storage.getItem(KEY)).toBe("all");
  });

  it("falls back to default for unknown stored values", () => {
    storage.setItem(KEY, "nonsense");
    expect(createPinyinGrade().grade()).toBe("all");
  });

  it("falls back to default for out-of-range numbers", () => {
    storage.setItem(KEY, "9");
    expect(createPinyinGrade().grade()).toBe("all");
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
    const g = createPinyinGrade();
    expect(g.grade()).toBe("all");
    g.setGrade(2);
    expect(g.grade()).toBe(2);
  });
});
