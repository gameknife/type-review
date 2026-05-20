import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";
import { TRAINER_STAGES } from "../../io";

const STORAGE_KEY = "type-review:trainer-stage";
const DEFAULT_STAGE = TRAINER_STAGES[0]?.id ?? 1;
const VALID_IDS: ReadonlySet<number> = new Set(TRAINER_STAGES.map((s) => s.id));

function readStored(): number {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_STAGE;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_STAGE;
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || !VALID_IDS.has(n)) return DEFAULT_STAGE;
    return n;
  } catch {
    return DEFAULT_STAGE;
  }
}

function write(value: number): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, String(value));
    }
  } catch {
    /* best effort */
  }
}

export interface TrainerStageControl {
  stageId: Accessor<number>;
  setStageId: (next: number) => void;
}

/**
 * Persisted stage selection for the trainer channel. Stage ids are the
 * 1-based ids defined in TRAINER_STAGES; unknown / out-of-range ids
 * fall back to stage 1 (the first home-row pair).
 */
export function createTrainerStage(): TrainerStageControl {
  const [stageId, setSignal] = createSignal<number>(readStored());
  return {
    stageId,
    setStageId: (next) => {
      // Defend against UI bugs that might pass a stale / made-up id.
      const safe = VALID_IDS.has(next) ? next : DEFAULT_STAGE;
      setSignal(safe);
      write(safe);
    },
  };
}
