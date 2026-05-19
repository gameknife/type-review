import type { JSX } from "solid-js";
import { createMemo, For, Index, Show } from "solid-js";
import type { RubyGroup } from "../engine/corpus";
import type { TypingSnapshot } from "../engine/typing";

export interface TypingAreaProps {
  typing: TypingSnapshot;
  /**
   * Show faint glyphs in place of invisible chars (space → ·, tab → →,
   * newline → ↵). Controlled by the Appearance → "Show whitespace
   * markers" toggle. When false the markers are suppressed via a
   * single CSS rule (`.typing-area--no-ws .char::before { content: none }`),
   * so toggling is just a class flip — no re-render of the char grid.
   */
  showWhitespace: boolean;
  /**
   * Optional ruby-style overlay. When present, the typing surface
   * switches to a two-row layout: the typed slice for each group sits
   * on the bottom (driving the engine as usual), and `group.display`
   * sits above it. Used by the pinyin source so a kid sees the Chinese
   * sentence as a guide while typing its pinyin.
   *
   * Groups must be sorted by `start` and not overlap; gaps render as
   * normal char spans inline (so spaces between pinyin syllables still
   * render, just without a glyph above them).
   */
  display?: readonly RubyGroup[];
}

/**
 * Renders the text to type, one span per character. The span list is
 * length-stable for a run, so `<Index>` keeps the DOM nodes and only the
 * `classList` accessors re-run when the snapshot changes — keystroke updates
 * touch the minimum amount of DOM.
 *
 * The char array is memoised on `expected`: a per-keystroke snapshot tick must
 * not recreate the array, only the per-position class accessors should re-run.
 *
 * When `display` is provided, the surface switches to a parallel ruby
 * layout (Chinese-glyph-above-pinyin-group). The per-character state
 * machine is unchanged — each char still owns its own span keyed by
 * absolute index into `expected`, so the engine snapshot drives both
 * layouts identically.
 */
export function TypingArea(props: TypingAreaProps): JSX.Element {
  const expected = createMemo(() => props.typing.expected);
  const chars = createMemo(() => [...expected()]);
  const segments = createMemo<readonly Segment[]>(() => {
    const display = props.display;
    if (!display || display.length === 0) return [];
    return computeSegments(expected(), display);
  });
  return (
    <section
      class="typing-area"
      classList={{
        "typing-area--no-ws": !props.showWhitespace,
        "typing-area--ruby": !!props.display && props.display.length > 0,
      }}
      aria-label="typing area"
    >
      <Show
        when={props.display && props.display.length > 0}
        fallback={<PlainChars chars={chars()} typing={props.typing} />}
      >
        <For each={segments()}>
          {(segment) =>
            segment.kind === "ruby" ? (
              <span class="ruby-group">
                <span class="ruby-group__display" aria-hidden="true">
                  {segment.display}
                </span>
                <span class="ruby-group__pinyin">
                  <CharRun
                    start={segment.start}
                    text={segment.text}
                    typing={props.typing}
                    {...(segment.toned ? { displayText: segment.toned } : {})}
                  />
                </span>
              </span>
            ) : segment.kind === "display" ? (
              <span class="ruby-group ruby-group--display-only">
                <span class="ruby-group__display" aria-hidden="true">
                  {segment.display}
                </span>
                <span class="ruby-group__pinyin ruby-group__pinyin--empty" aria-hidden="true" />
              </span>
            ) : (
              <CharRun start={segment.start} text={segment.text} typing={props.typing} />
            )
          }
        </For>
      </Show>
    </section>
  );
}

/**
 * Inline-mode renderer — the original `<Index>` loop. Kept as its own
 * component so the ruby branch can swap it out via `<Show>` without
 * touching its reactivity contract.
 */
function PlainChars(props: { chars: readonly string[]; typing: TypingSnapshot }): JSX.Element {
  return (
    <Index each={props.chars}>
      {(char, index) => (
        <span
          classList={{
            char: true,
            "char--correct": props.typing.statuses[index] === "correct",
            "char--incorrect": props.typing.statuses[index] === "incorrect",
            "char--current": index === props.typing.pos,
            "char--space": char() === " ",
            "char--tab": char() === "\t",
            "char--newline": char() === "\n",
          }}
        >
          {char()}
        </span>
      )}
    </Index>
  );
}

/**
 * Render a contiguous slice of the expected text starting at `start`.
 * Each char span has the same classList semantics as the inline mode;
 * absolute indices into `typing.statuses` / `typing.pos` are preserved
 * so the same engine state drives both layouts.
 *
 * `displayText` (optional) substitutes a same-length string of glyphs to
 * SHOW in place of the engine's `text`. Used by the pinyin source so
 * each typed letter renders with its tone-marked counterpart (`o` →
 * `ǒ`) while the engine still compares plain ASCII (`o` typed against
 * expected `o`). Caller must guarantee `[...displayText].length ===
 * [...text].length` — when they diverge the override is dropped per-
 * position so a bad row degrades to plain instead of misaligning the
 * cursor.
 */
function CharRun(props: {
  start: number;
  text: string;
  typing: TypingSnapshot;
  displayText?: string;
}): JSX.Element {
  const chars = createMemo(() => [...props.text]);
  const displayChars = createMemo<readonly string[] | null>(() => {
    if (!props.displayText) return null;
    const seq = [...props.displayText];
    return seq.length === chars().length ? seq : null;
  });
  return (
    <Index each={chars()}>
      {(char, i) => {
        const abs = (): number => props.start + i;
        const glyph = (): string => displayChars()?.[i] ?? char();
        return (
          <span
            classList={{
              char: true,
              "char--correct": props.typing.statuses[abs()] === "correct",
              "char--incorrect": props.typing.statuses[abs()] === "incorrect",
              "char--current": abs() === props.typing.pos,
              "char--space": char() === " ",
              "char--tab": char() === "\t",
              "char--newline": char() === "\n",
            }}
          >
            {glyph()}
          </span>
        );
      }}
    </Index>
  );
}

type Segment =
  | { kind: "ruby"; start: number; text: string; display: string; toned?: string }
  | { kind: "display"; start: number; display: string; toned?: string }
  | { kind: "plain"; start: number; text: string };

/**
 * Convert `(expected, groups)` into a flat alternating segment list.
 * Plain segments cover the gaps between ruby groups (typically the
 * separating spaces). Groups outside `[0, expected.length)` are dropped
 * defensively — bad data shouldn't crash the run.
 */
function computeSegments(expected: string, groups: readonly RubyGroup[]): Segment[] {
  const out: Segment[] = [];
  const sorted = [...groups].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const g of sorted) {
    if (g.start < cursor) continue;
    if (g.start > expected.length) continue;
    if (g.pinyin.length === 0) {
      if (g.start > cursor) {
        out.push({ kind: "plain", start: cursor, text: expected.slice(cursor, g.start) });
        cursor = g.start;
      }
      out.push({
        kind: "display",
        start: g.start,
        display: g.display,
        ...(g.toned ? { toned: g.toned } : {}),
      });
      continue;
    }
    if (g.start + g.pinyin.length > expected.length) continue;
    if (g.start > cursor) {
      out.push({ kind: "plain", start: cursor, text: expected.slice(cursor, g.start) });
    }
    out.push({
      kind: "ruby",
      start: g.start,
      text: expected.slice(g.start, g.start + g.pinyin.length),
      display: g.display,
      ...(g.toned ? { toned: g.toned } : {}),
    });
    cursor = g.start + g.pinyin.length;
  }
  if (cursor < expected.length) {
    out.push({ kind: "plain", start: cursor, text: expected.slice(cursor) });
  }
  return out;
}
