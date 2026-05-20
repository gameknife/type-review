import type { Accessor, JSX } from "solid-js";
import { For, Show } from "solid-js";
import type { LessonKey, LessonPlan } from "../../engine/adaptive";

/**
 * Simplified ANSI keyboard for kids. Differences from the grown-up
 * `OnScreenKeyboard`:
 *  - no fn-row, no mac/windows variants, no keymap remapper
 *  - chunky pastel-coloured modifier rows (the colour identifies the
 *    finger zone, mirrors the screenshot)
 *  - inline number-row carries the shifted glyph as a smaller top label
 *  - heat tint is dropped: the kid UI surfaces the focus letter with a
 *    soft outline (no scary slow-key red)
 */

type KidKey = {
  readonly id: string;
  /** Main glyph rendered on the cap. */
  readonly label: string;
  /** Optional smaller shifted glyph above the main label. */
  readonly shifted?: string;
  /** Width in `u` (1u = base cap). */
  readonly width: number;
  /** `KeyboardEvent.code` values that drive pressed-state. */
  readonly codes?: readonly string[];
  /** Lowercase letter used to match the lesson-plan focus key. */
  readonly letter?: string;
  /**
   * Visual treatment. `mod` = chunky coloured modifier; `space` = wide
   * neutral bar. Plain undefined → white letter cap.
   */
  readonly variant?: "mod" | "space";
  /** Pastel tint for modifier caps. */
  readonly tone?: "red" | "orange" | "yellow" | "green" | "blue" | "purple";
  /** Right-align the label inside the cap (used for backspace / enter). */
  readonly align?: "start" | "end";
};

const ROW_FN: readonly KidKey[] = [
  { id: "esc", label: "esc", width: 1.5, codes: ["Escape"], variant: "mod", tone: "blue" },
  { id: "1", label: "1", shifted: "!", width: 1, codes: ["Digit1"], letter: "1" },
  { id: "2", label: "2", shifted: "@", width: 1, codes: ["Digit2"], letter: "2" },
  { id: "3", label: "3", shifted: "#", width: 1, codes: ["Digit3"], letter: "3" },
  { id: "4", label: "4", shifted: "$", width: 1, codes: ["Digit4"], letter: "4" },
  { id: "5", label: "5", shifted: "%", width: 1, codes: ["Digit5"], letter: "5" },
  { id: "6", label: "6", shifted: "^", width: 1, codes: ["Digit6"], letter: "6" },
  { id: "7", label: "7", shifted: "&", width: 1, codes: ["Digit7"], letter: "7" },
  { id: "8", label: "8", shifted: "*", width: 1, codes: ["Digit8"], letter: "8" },
  { id: "9", label: "9", shifted: "(", width: 1, codes: ["Digit9"], letter: "9" },
  { id: "0", label: "0", shifted: ")", width: 1, codes: ["Digit0"], letter: "0" },
  { id: "-", label: "-", shifted: "_", width: 1, codes: ["Minus"], letter: "-" },
  { id: "=", label: "+", shifted: "=", width: 1, codes: ["Equal"], letter: "=" },
  {
    id: "backspace",
    label: "←",
    width: 1.8,
    codes: ["Backspace"],
    variant: "mod",
    tone: "blue",
    align: "end",
  },
];

const ROW_Q: readonly KidKey[] = [
  {
    id: "tab",
    label: "Tab",
    width: 1.5,
    codes: ["Tab"],
    variant: "mod",
    tone: "red",
    align: "start",
  },
  { id: "q", label: "q", width: 1, codes: ["KeyQ"], letter: "q" },
  { id: "w", label: "w", width: 1, codes: ["KeyW"], letter: "w" },
  { id: "e", label: "e", width: 1, codes: ["KeyE"], letter: "e" },
  { id: "r", label: "r", width: 1, codes: ["KeyR"], letter: "r" },
  { id: "t", label: "t", width: 1, codes: ["KeyT"], letter: "t" },
  { id: "y", label: "y", width: 1, codes: ["KeyY"], letter: "y" },
  { id: "u", label: "u", width: 1, codes: ["KeyU"], letter: "u" },
  { id: "i", label: "i", width: 1, codes: ["KeyI"], letter: "i" },
  { id: "o", label: "o", width: 1, codes: ["KeyO"], letter: "o" },
  { id: "p", label: "p", width: 1, codes: ["KeyP"], letter: "p" },
  { id: "[", label: "[", shifted: "{", width: 1, codes: ["BracketLeft"], letter: "[" },
  { id: "]", label: "]", shifted: "}", width: 1, codes: ["BracketRight"], letter: "]" },
  { id: "\\", label: "\\", shifted: "|", width: 1.3, codes: ["Backslash"], letter: "\\" },
];

const ROW_A: readonly KidKey[] = [
  {
    id: "caps",
    label: "Caps",
    width: 1.8,
    codes: ["CapsLock"],
    variant: "mod",
    tone: "green",
    align: "start",
  },
  { id: "a", label: "a", width: 1, codes: ["KeyA"], letter: "a" },
  { id: "s", label: "s", width: 1, codes: ["KeyS"], letter: "s" },
  { id: "d", label: "d", width: 1, codes: ["KeyD"], letter: "d" },
  { id: "f", label: "f", width: 1, codes: ["KeyF"], letter: "f" },
  { id: "g", label: "g", width: 1, codes: ["KeyG"], letter: "g" },
  { id: "h", label: "h", width: 1, codes: ["KeyH"], letter: "h" },
  { id: "j", label: "j", width: 1, codes: ["KeyJ"], letter: "j" },
  { id: "k", label: "k", width: 1, codes: ["KeyK"], letter: "k" },
  { id: "l", label: "l", width: 1, codes: ["KeyL"], letter: "l" },
  { id: ";", label: ";", shifted: ":", width: 1, codes: ["Semicolon"], letter: ";" },
  { id: "'", label: '"', shifted: "'", width: 1, codes: ["Quote"], letter: "'" },
  {
    id: "enter",
    label: "Enter",
    width: 2,
    codes: ["Enter"],
    variant: "mod",
    tone: "blue",
    align: "end",
  },
];

const ROW_Z: readonly KidKey[] = [
  {
    id: "lshift",
    label: "Shift",
    width: 2.3,
    codes: ["ShiftLeft"],
    variant: "mod",
    tone: "yellow",
    align: "start",
  },
  { id: "z", label: "z", width: 1, codes: ["KeyZ"], letter: "z" },
  { id: "x", label: "x", width: 1, codes: ["KeyX"], letter: "x" },
  { id: "c", label: "c", width: 1, codes: ["KeyC"], letter: "c" },
  { id: "v", label: "v", width: 1, codes: ["KeyV"], letter: "v" },
  { id: "b", label: "b", width: 1, codes: ["KeyB"], letter: "b" },
  { id: "n", label: "n", width: 1, codes: ["KeyN"], letter: "n" },
  { id: "m", label: "m", width: 1, codes: ["KeyM"], letter: "m" },
  { id: ",", label: ",", shifted: "<", width: 1, codes: ["Comma"], letter: "," },
  { id: ".", label: ".", shifted: ">", width: 1, codes: ["Period"], letter: "." },
  { id: "/", label: "?", shifted: "/", width: 1, codes: ["Slash"], letter: "/" },
  {
    id: "rshift",
    label: "Shift",
    width: 2,
    codes: ["ShiftRight"],
    variant: "mod",
    tone: "yellow",
    align: "end",
  },
];

const ROW_SPACE: readonly KidKey[] = [
  {
    id: "lctrl",
    label: "Ctrl",
    width: 1.4,
    codes: ["ControlLeft"],
    variant: "mod",
    tone: "purple",
    align: "start",
  },
  {
    id: "lalt",
    label: "Alt",
    width: 1.4,
    codes: ["AltLeft"],
    variant: "mod",
    tone: "orange",
    align: "start",
  },
  { id: "space", label: " ", width: 7, codes: ["Space"], letter: " ", variant: "space" },
  {
    id: "ralt",
    label: "Alt",
    width: 1.4,
    codes: ["AltRight"],
    variant: "mod",
    tone: "orange",
    align: "end",
  },
  {
    id: "rctrl",
    label: "Ctrl",
    width: 1.4,
    codes: ["ControlRight"],
    variant: "mod",
    tone: "purple",
    align: "end",
  },
];

const ROWS: readonly (readonly KidKey[])[] = [ROW_FN, ROW_Q, ROW_A, ROW_Z, ROW_SPACE];

export interface KidsKeyboardProps {
  plan: LessonPlan | null;
  /** Currently-held `KeyboardEvent.code` values. */
  pressed: Accessor<ReadonlySet<string>>;
}

/**
 * Render the kid keyboard. Per-letter heatmap is intentionally omitted —
 * the focus letter gets a soft accent ring (the only learning cue) and
 * everything else stays a friendly white. The grown-up keyboard's slow-
 * key red would feel like a scolding to a beginner.
 */
export function KidsKeyboard(props: KidsKeyboardProps): JSX.Element {
  const focusLetter = (): string | null => props.plan?.focus ?? null;
  const lessonByLetter = (): ReadonlyMap<string, LessonKey> => {
    const m = new Map<string, LessonKey>();
    if (props.plan) {
      for (const k of props.plan.keys) m.set(k.letter, k);
    }
    return m;
  };

  return (
    <section class="kid-kb" aria-label="kids keyboard">
      <For each={ROWS}>
        {(row) => (
          <div class="kid-kb__row">
            <For each={row}>
              {(key) => {
                const isPressed = (): boolean =>
                  (key.codes ?? []).some((c) => props.pressed().has(c));
                const isFocus = (): boolean =>
                  key.letter !== undefined && focusLetter() === key.letter;
                const included = (): boolean => {
                  if (key.letter === undefined) return true;
                  const k = lessonByLetter().get(key.letter);
                  return k?.included ?? true;
                };
                return (
                  <div
                    class="kid-key"
                    classList={{
                      "kid-key--mod": key.variant === "mod",
                      "kid-key--space": key.variant === "space",
                      "kid-key--pressed": isPressed(),
                      "kid-key--focus": isFocus(),
                      "kid-key--dim": !included(),
                      "kid-key--align-start": key.align === "start",
                      "kid-key--align-end": key.align === "end",
                      [`kid-key--${key.tone ?? ""}`]: key.tone !== undefined,
                    }}
                    style={{ "--kw": key.width }}
                    aria-hidden="true"
                  >
                    <Show when={key.shifted}>
                      {(shifted) => <span class="kid-key__shifted">{shifted()}</span>}
                    </Show>
                    <span class="kid-key__label">{key.label}</span>
                  </div>
                );
              }}
            </For>
          </div>
        )}
      </For>
    </section>
  );
}
