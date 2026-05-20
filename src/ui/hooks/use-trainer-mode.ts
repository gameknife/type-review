import type { Accessor } from "solid-js";
import { createSignal } from "solid-js";
import type { TrainerMode } from "../../io";

const STORAGE_KEY = "type-review:trainer-mode";
const DEFAULT_MODE: TrainerMode = "mixed";
const VALID: ReadonlySet<string> = new Set<TrainerMode>(["mixed", "solo"]);

function readStored(): TrainerMode {
  try {
    if (typeof localStorage === "undefined") return DEFAULT_MODE;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null || !VALID.has(raw)) return DEFAULT_MODE;
    return raw as TrainerMode;
  } catch {
    return DEFAULT_MODE;
  }
}

function write(value: TrainerMode): void {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(STORAGE_KEY, value);
    }
  } catch {
    /* best effort */
  }
}

export interface TrainerModeControl {
  mode: Accessor<TrainerMode>;
  setMode: (next: TrainerMode) => void;
}

/**
 * Persisted practice-mode toggle for the trainer channel.
 *  - `mixed` (default): full cumulative pool — current behaviour
 *  - `solo`: only the stage's spotlight pair, so a kid can drill
 *    `sl sl ll ss` in isolation before mixing back in.
 */
export function createTrainerMode(): TrainerModeControl {
  const [mode, setSignal] = createSignal<TrainerMode>(readStored());
  return {
    mode,
    setMode: (next) => {
      const safe: TrainerMode = VALID.has(next) ? next : DEFAULT_MODE;
      setSignal(safe);
      write(safe);
    },
  };
}
