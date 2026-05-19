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
 */
export function createPinyinSource(raw: readonly RawPinyin[]): CorpusSource {
  const entries: CorpusEntry[] = [];
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
  }

  return {
    pick(ctx) {
      const candidates = ctx.filter
        ? entries.filter((e) => fitsAlphabet(e, ctx.filter as ReadonlySet<string>))
        : entries;
      return pickWeightedByLength(candidates, ctx.wantedChars, ctx.rng);
    },
  };
}
