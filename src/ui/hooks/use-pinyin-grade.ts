import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";
import type { PinyinGrade } from "../../io";

const STORAGE_KEY = "type-review:pinyin-grade";
const DEFAULT_GRADE: PinyinGrade = "all";
const VALID: ReadonlySet<string> = new Set(["all", "1", "2", "3", "4", "5", "6"]);

function readStored(): PinyinGrade {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_GRADE;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || !VALID.has(raw)) return DEFAULT_GRADE;
    if (raw === "all") return "all";
    const n = Number.parseInt(raw, 10);
    return n as PinyinGrade;
  } catch {
    return DEFAULT_GRADE;
  }
}

function write(value: PinyinGrade): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    /* best effort */
  }
}

export interface PinyinGradeControl {
  grade: Accessor<PinyinGrade>;
  setGrade: (next: PinyinGrade) => void;
}

/**
 * Persisted 小学年级 selection for the pinyin sub-picker. "all" means
 * "don't filter by grade" — the source picks across every entry. Numeric
 * grades 1..6 narrow the pool to sentences tagged with that bucket by
 * the `scripts/build-pinyin-corpus.ts` pipeline.
 */
export function createPinyinGrade(): PinyinGradeControl {
  const [grade, setSignal] = createSignal<PinyinGrade>(readStored());
  return {
    grade,
    setGrade: (next) => {
      setSignal(next);
      write(next);
    },
  };
}
