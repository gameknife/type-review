import type { CorpusEntry, CorpusSource, RubyGroup } from "../../engine/corpus";
import { fitsAlphabet, makeEntry, pickWeightedByLength } from "../../engine/corpus";

/**
 * Raw shape for one bundled pinyin entry. `characters[i]` is the glyph
 * shown above the i-th group (one hanzi, or punctuation, or any short
 * display string); `pinyin[i]` is what the user types for that group
 * (lowercase a-z, empty string for pure-display cells like punctuation).
 * The arrays MUST be the same length.
 */
export interface RawPinyin {
  id: string;
  characters: readonly string[];
  pinyin: readonly string[];
  /**
   * Optional parallel array of tone-marked pinyin (e.g. ["wǒ","ài","mā","ma"]).
   * Displayed above the typed row so a kid sees the tones while only typing
   * the plain letters. When omitted, the UI falls back to showing the hanzi
   * directly above the typed letters with no toned row.
   */
  toned?: readonly string[];
  license: string;
  /**
   * Reading-difficulty bucket aligned with 小学6年级 (1..6). Populated by
   * scripts/build-pinyin-corpus.ts based on the max HSK 3.0 level of the
   * characters in the sentence. Hand-curated legacy entries default to
   * grade 1 (kindergarten level). The pinyin source itself does not filter
   * on this field — the channel composite / UI does — so omitting it is
   * harmless to the engine.
   */
  grade?: number;
  /**
   * Short tag identifying the corpus this entry was generated from
   * (e.g. "tang", "sanzi", "prov"). Informational; not currently used
   * by the engine but useful in the JSON for debugging and future
   * source-level filtering.
   */
  source?: string;
}

/**
 * The grade selector exposed to the UI sub-picker. "all" means "no
 * filter" (every entry is eligible); a number 1..6 narrows the pool to
 * entries tagged with that 小学年级 bucket.
 */
export type PinyinGrade = "all" | 1 | 2 | 3 | 4 | 5 | 6;

export interface PinyinSourceOptions {
  /**
   * Live read of the active grade. The source consults this on every
   * `pick`, so flipping the sub-picker takes effect on the next run
   * without having to rebuild the source. Omitting it is equivalent to
   * a static `"all"`.
   */
  getGrade?: () => PinyinGrade;
}

/**
 * Build a `CorpusSource` over pinyin practice sentences. Each entry is
 * compiled into:
 *   - `text` — pinyin syllables joined by a single space, the ground
 *     truth the engine drives `TextInput` from. Pure ASCII so every
 *     existing filter / stats / on-screen keyboard path keeps working.
 *   - `display` — a `RubyGroup[]` covering every typed slice with the
 *     Chinese glyph that belongs above it. Pure-display cells (empty
 *     pinyin) are skipped; the engine only sees the typed slices.
 *
 * Ids carry the `py-` prefix that `CHANNELS` registers, so a completed
 * run is correctly classified back to the pinyin channel by the Stats
 * aggregator at display time.
 *
 * The alphabet filter is honoured the same way as other static sources:
 * an entry whose letters fall outside an adaptive-mode `Filter` is
 * skipped. In practice the pinyin channel is picked explicitly from the
 * source dropdown, so the composite drops the filter before calling
 * `pick` and every entry is eligible.
 *
 * Grade tag travels alongside each entry in a parallel array (not on
 * `CorpusEntry` itself) — only the pinyin channel cares about it, and
 * adding the field to the universal entry shape would muddle the
 * engine boundary.
 */
export function createPinyinSource(
  raw: readonly RawPinyin[],
  opts: PinyinSourceOptions = {},
): CorpusSource {
  const entries: CorpusEntry[] = [];
  const grades: (number | undefined)[] = [];
  for (const r of raw) {
    if (r.characters.length !== r.pinyin.length) {
      throw new Error(
        `pinyin entry ${r.id}: characters (${r.characters.length}) and pinyin (${r.pinyin.length}) must match`,
      );
    }
    if (r.toned && r.toned.length !== r.pinyin.length) {
      throw new Error(
        `pinyin entry ${r.id}: toned (${r.toned.length}) and pinyin (${r.pinyin.length}) must match`,
      );
    }
    const groups: RubyGroup[] = [];
    const typedParts: string[] = [];
    let cursor = 0;
    for (let i = 0; i < r.pinyin.length; i++) {
      const py = r.pinyin[i] ?? "";
      const display = r.characters[i] ?? "";
      const toned = r.toned?.[i];
      if (py.length === 0) {
        groups.push({
          start: cursor,
          pinyin: "",
          display,
          ...(toned ? { toned } : {}),
        });
        continue;
      }
      if (typedParts.length > 0) {
        typedParts.push(" ");
        cursor += 1;
      }
      groups.push({
        start: cursor,
        pinyin: py,
        display,
        ...(toned ? { toned } : {}),
      });
      typedParts.push(py);
      cursor += py.length;
    }
    const text = typedParts.join("");
    if (text.length === 0) continue;
    entries.push(makeEntry(r.id, "pinyin", text, { license: r.license }, groups));
    grades.push(r.grade);
  }

  return {
    pick(ctx) {
      const wantedGrade = opts.getGrade?.() ?? "all";
      const indices: number[] = [];
      for (let i = 0; i < entries.length; i++) {
        const e = entries[i] as CorpusEntry;
        if (ctx.filter && !fitsAlphabet(e, ctx.filter as ReadonlySet<string>)) continue;
        if (wantedGrade !== "all" && grades[i] !== wantedGrade) continue;
        indices.push(i);
      }
      // If the user picked a grade with no entries we'd otherwise return
      // null and the composite would tumble into a fallback channel —
      // surprising for the user, who expected Chinese. Widen back to
      // "all" so they still get *some* pinyin practice.
      const candidates =
        indices.length === 0 && wantedGrade !== "all"
          ? entries.filter((e) => !ctx.filter || fitsAlphabet(e, ctx.filter as ReadonlySet<string>))
          : indices.map((i) => entries[i] as CorpusEntry);
      return pickWeightedByLength(candidates, ctx.wantedChars, ctx.rng);
    },
  };
}
