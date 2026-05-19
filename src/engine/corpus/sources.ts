/**
 * Pluggable corpus sources — the abstraction that lets bundled quotes,
 * bundled articles, user uploads, and the existing generators all feed
 * the typing engine through one interface.
 *
 * Each source returns `CorpusEntry` values; the Session layer adapts those
 * to its `Passage` shape. Pure TS — no DOM, no Vite globs, no IDB. Loaders
 * for each kind live in `io/corpus/`.
 */

export type SourceKind = "drills" | "difficult" | "quote" | "code" | "user" | "pinyin";

/**
 * Optional ruby-style display annotation for an entry. Used by the pinyin
 * source so the UI can render Chinese characters above the (typed) pinyin
 * groups without the engine ever seeing non-Latin input. Each
 * `RubyGroup` covers one contiguous slice of `text` — `start` is the
 * inclusive index, `text.slice(start, start + pinyin.length)` is what
 * the typist actually presses, and `display` is what's shown above the
 * group. Spaces between groups (and any other chars not covered) render
 * normally below the row.
 *
 * Engine-pure: the display annotation never feeds back into stats,
 * histograms, or the adaptive planner — it's pure UI metadata that
 * passes through `CorpusEntry → Passage → currentEntry → TypingArea`.
 */
export interface RubyGroup {
  /** Index into the entry's `text` where this group begins. */
  start: number;
  /**
   * The pinyin syllable (or word) the user types. Non-empty values must
   * be a slice of `text` at `start`; the empty string denotes a
   * display-only cell (for punctuation, etc.) at that cursor boundary.
   */
  pinyin: string;
  /** The glyph(s) shown above the group — typically one Chinese character, may be multi-codepoint. */
  display: string;
  /**
   * Optional decorative variant of the pinyin shown above the typed row
   * — typically the same syllable with tone marks (e.g. "wǒ" for the
   * typed "wo"). Pure display: the user still types only `pinyin`. When
   * absent, the UI just shows `display` (hanzi) above the typed letters
   * with no middle row.
   */
  toned?: string;
}

export interface CorpusAttribution {
  author?: string;
  title?: string;
  url?: string;
  /**
   * Plain-text license declaration shown to the user. Examples:
   * "public domain", "fair-use snippet", "CC-BY-SA from Wikiquote".
   */
  license: string;
}

export interface CorpusEntry {
  /** Stable id used in run results for attribution lookup. */
  id: string;
  kind: SourceKind;
  text: string;
  /**
   * Lowercase typeable characters appearing in `text` — pre-computed for
   * fast filter and stats. Includes letters, digits, and punctuation;
   * whitespace (space / tab / newline) is excluded because it isn't
   * gated by the adaptive curriculum. Only the LETTER subset is enforced
   * by `fitsAlphabet`; see that function for the rationale.
   */
  alphabet: ReadonlySet<string>;
  /** Length of `text` in code units. */
  length: number;
  /** Required for `quote` / `user`; omitted for the generator-backed
   * sources (`drills`, `difficult`). */
  attribution?: CorpusAttribution;
  /**
   * Ruby-style display groups (e.g. Chinese-on-top-of-pinyin). Present
   * only for sources that opt in (`pinyin`). The UI is the sole
   * consumer; the engine treats `text` as the ground truth as always.
   */
  display?: readonly RubyGroup[];
}

export interface CorpusSourceContext {
  /**
   * Allowed letters for adaptive mode. Every LETTER in a returned entry's
   * `alphabet` must be a member; digits and punctuation in curated
   * content are always allowed regardless of the filter (see
   * `fitsAlphabet`). `undefined` means "no alphabet constraint" — the
   * benchmark-mode case.
   */
  filter?: ReadonlySet<string>;
  /** Approximate desired length in characters. Source may return ±50%. */
  wantedChars: number;
  /** RNG in [0, 1). Pure for determinism in tests. */
  rng: () => number;
}

export interface CorpusSource {
  /** Pick one entry matching the context. Returns null if none fit. */
  pick(ctx: CorpusSourceContext): CorpusEntry | null;
}

/* ───────────────────────── helpers ─────────────────────────── */

const LETTER = /\p{Letter}/u;
const WHITESPACE = /\s/;

/**
 * Returns the set of lowercase typeable characters appearing in `text`.
 * Letters are lowercased; digits and punctuation are kept as-is.
 * Whitespace is excluded because the adaptive curriculum doesn't gate
 * spaces / newlines — every alphabet implicitly types them.
 */
export function alphabetOf(text: string): ReadonlySet<string> {
  const set = new Set<string>();
  for (const ch of text) {
    if (WHITESPACE.test(ch)) continue;
    set.add(ch.toLowerCase());
  }
  return set;
}

/**
 * True iff every LETTER in `entry.alphabet` is in `filter`.
 *
 * Split semantics: the filter only gates LETTERS. Digits and punctuation
 * in curated content (quotes, code, user passages) always pass through
 * regardless of `includeNumbers` / `includePunctuation` — those toggles
 * only control whether the curriculum tracks digits/punctuation as
 * dedicated keys (via the wider alphabet) and whether drill generators
 * (`generatePseudoWords`, `generatePlainWords`) include them in
 * generated content. The intent matches what users mean by "include
 * punctuation in the adaptive alphabet": drill me on commas as part of
 * the curriculum, not "filter out every quote containing a comma".
 */
export function fitsAlphabet(entry: CorpusEntry, filter: ReadonlySet<string>): boolean {
  for (const ch of entry.alphabet) {
    if (LETTER.test(ch) && !filter.has(ch)) return false;
  }
  return true;
}

/**
 * Score how close an entry's length is to the wanted length. Returns a value
 * in [0, 1] — 1 means "perfect match". Triangular kernel peaking at ratio=1,
 * sloping linearly to 0 at ratio=0.5 (left edge) and ratio=3 (right edge).
 * Ratios outside that range score 0 — entries far from the wanted size are
 * effectively skipped during weighted picking.
 */
export function lengthScore(entryLength: number, wantedChars: number): number {
  if (wantedChars <= 0) return 0;
  const ratio = entryLength / wantedChars;
  if (ratio < 0.5 || ratio > 3) return 0;
  if (ratio <= 1) return 2 * ratio - 1;
  return (3 - ratio) / 2;
}

/**
 * Pick a random entry from `candidates`, weighted by `lengthScore`. Returns
 * null if `candidates` is empty.
 */
export function pickWeightedByLength(
  candidates: readonly CorpusEntry[],
  wantedChars: number,
  rng: () => number,
): CorpusEntry | null {
  if (candidates.length === 0) return null;
  const weights = candidates.map((c) => Math.max(0.01, lengthScore(c.length, wantedChars)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let pick = rng() * total;
  for (let i = 0; i < candidates.length; i++) {
    pick -= weights[i] ?? 0;
    if (pick <= 0) {
      const entry = candidates[i];
      if (entry !== undefined) return entry;
    }
  }
  return candidates[candidates.length - 1] ?? null;
}

/**
 * Build a `CorpusEntry` from the raw fields. Pre-computes `alphabet` so
 * subsequent `fitsAlphabet` checks stay fast. `display` is an optional
 * passthrough for ruby-style overlays (currently the pinyin source).
 */
export function makeEntry(
  id: string,
  kind: SourceKind,
  text: string,
  attribution?: CorpusAttribution,
  display?: readonly RubyGroup[],
): CorpusEntry {
  return {
    id,
    kind,
    text,
    alphabet: alphabetOf(text),
    length: text.length,
    ...(attribution ? { attribution } : {}),
    ...(display ? { display } : {}),
  };
}
