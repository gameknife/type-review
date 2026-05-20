import type { CorpusSource, Filter } from "../../engine/corpus";
import { generatePseudoWords, makeEntry } from "../../engine/corpus";
import type { TrainerStage } from "./trainer-stages";
import { TRAINER_STAGES, trainerStageById } from "./trainer-stages";

/**
 * The first stage's id — what the source falls back to when no stage
 * accessor is supplied (e.g. in tests). Kept as a named export so
 * future callers can reference the curriculum entry point without
 * hard-coding `1`.
 */
export const TRAINER_DEFAULT_STAGE = TRAINER_STAGES[0]?.id ?? 1;

export interface TrainerSourceOptions {
  /**
   * Live read of the active stage id. The source consults this on every
   * `pick`, so flipping the sub-picker takes effect on the next run
   * without rebuilding the source. Omitting it pins the source to
   * `TRAINER_DEFAULT_STAGE` — useful for unit tests.
   */
  getStageId?: () => number;
  /** RNG override. Defaults to `Math.random` — production wires `Math.random` too. */
  rng?: () => number;
}

/**
 * Beginner-curriculum corpus channel. Re-uses the existing
 * `generatePseudoWords` engine with a per-stage `Filter` derived from
 * `TRAINER_STAGES`. The first newly-introduced character is used as the
 * `focus`, so most generated words contain the new key — that's where
 * the muscle-memory drill actually happens.
 *
 * Passage ids are `trainer-<stageId>-<short-text-prefix>` so the Stats
 * source classifier can attribute completed runs back to this channel
 * via the `trainer-` prefix registered in CHANNELS.
 */
export function createTrainerSource(opts: TrainerSourceOptions = {}): CorpusSource {
  const rng = opts.rng ?? Math.random;
  const getStageId = opts.getStageId ?? (() => TRAINER_DEFAULT_STAGE);

  return {
    pick(ctx) {
      const stage = trainerStageById(getStageId());
      // Intersect the stage's pool with any adaptive-mode `Filter` so a
      // user-driven letter restriction (rare; trainer is explicit-only)
      // doesn't let us emit characters they haven't unlocked elsewhere.
      const allowed = ctx.filter
        ? stage.chars.filter((c) => c === " " || ctx.filter?.has(c.toLowerCase()))
        : [...stage.chars];
      if (allowed.length <= 1) {
        // Only whitespace — nothing meaningful to type. The composite's
        // fallback chain handles this.
        return null;
      }
      const filter: Filter = {
        allowed,
        focus: pickFocus(stage, allowed),
      };
      // Beginner content runs short — Tippsy's first lessons are roughly
      // 25-30 keystrokes. `wantedChars / 5.5` is the legacy formula used
      // by the difficult / drills sources; ÷ 6 keeps trainer passages a
      // bit punchier so a kid sees a "done" screen sooner.
      const wordCount = Math.max(4, Math.round(ctx.wantedChars / 6));
      const passage = generatePseudoWords(filter, { wordCount, rng });
      // Re-tag with the trainer- prefix so the channel classifier picks
      // it up. We deliberately drop the `pseudo:` prefix that the
      // generator stamps on its passage id.
      const id = `trainer-${stage.id}-${passage.text.slice(0, 24)}`.replace(/\s+/g, "_");
      return makeEntry(id.slice(0, 64), "trainer", passage.text);
    },
  };
}

/**
 * Choose the focus letter for a stage. Prefers `newChars[0]` when it's
 * still in the (possibly filter-narrowed) allowed pool; falls back to
 * any other newly-introduced char, then to null. Punctuation / uppercase
 * stages have newChars that may not be lowercase letters — the existing
 * `Filter.focus` semantics tolerate that since the focus is just a
 * weighted choice in `generatePseudoWords`.
 */
function pickFocus(stage: TrainerStage, allowed: readonly string[]): string | null {
  const allowedSet = new Set(allowed);
  for (const c of stage.newChars) {
    if (allowedSet.has(c)) return c;
  }
  return null;
}
