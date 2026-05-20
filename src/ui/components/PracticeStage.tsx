import type { Accessor, JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import type { CorpusEntry } from "../../engine/corpus";
import type { SessionSnapshot } from "../../engine/session";
import type { ChannelName, PinyinGrade, TrainerMode } from "../../io";
import { CHANNELS, KEY_SOUND_PACKS, TRAINER_STAGES } from "../../io";
import { createKeyboardToggle } from "../hooks/use-keyboard-toggle";
import { TypingArea } from "../TypingArea";
import { InlineSegRadio } from "./InlineSegRadio";
import type { KeyboardLayoutName } from "./keyboard-layouts";
import type { KeyMap } from "./keymaps";
import { OnScreenKeyboard } from "./OnScreenKeyboard";

/**
 * True iff this device has only a coarse pointer (touch, no mouse).
 * The on-screen keyboard is redundant on phones — the OS keyboard is the
 * thing the user is actually pressing — so we hide the toggle there.
 */
function isTouchOnly(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(pointer: coarse) and (hover: none)").matches;
}

// Inline pickers on the practice page are reserved for the controls users
// actually flip mid-session: source (content channel) and sound (mute /
// switch pack). The other two — layout (mac/win) and keymap (qwerty/
// colemak/dvorak) — are set-once-and-forget preferences; they live on the
// Settings page now.
const SOUND_OPTIONS = KEY_SOUND_PACKS.map((p) => ({ value: p.name, label: p.label }));
// Derived from the canonical CHANNELS table so renaming or adding a
// channel only requires editing channel-meta.ts.
const SOURCE_OPTIONS: ReadonlyArray<{ value: ChannelName; label: string }> = CHANNELS.map((c) => ({
  value: c.name,
  label: c.label,
}));

// Sub-picker shown only when the active channel is `pinyin`. Filters the
// pool to a 小学年级 bucket (matches the grades tagged on each entry by
// scripts/build-pinyin-corpus.ts). "all" keeps the unfiltered pool.
const PINYIN_GRADE_OPTIONS: ReadonlyArray<{ value: PinyinGrade; label: string }> = [
  { value: "all", label: "all" },
  { value: 1, label: "G1" },
  { value: 2, label: "G2" },
  { value: 3, label: "G3" },
  { value: 4, label: "G4" },
  { value: 5, label: "G5" },
  { value: 6, label: "G6" },
];

// Sub-picker shown only when the active channel is `trainer`. Each entry
// corresponds to one curriculum stage defined in trainer-stages.ts; the
// label is the stage's letter pair (e.g. `fj`, `dk`) which doubles as a
// reminder of what the kid is drilling.
const TRAINER_STAGE_OPTIONS: ReadonlyArray<{ value: number; label: string }> = TRAINER_STAGES.map(
  (s) => ({ value: s.id, label: s.label }),
);

// Second-row sub-picker — switches between drilling just the stage's
// spotlight pair (`solo`) and the cumulative pool (`mixed`).
const TRAINER_MODE_OPTIONS: ReadonlyArray<{ value: TrainerMode; label: string }> = [
  { value: "mixed", label: "mixed" },
  { value: "solo", label: "solo" },
];

export interface PracticeStageProps {
  snap: SessionSnapshot;
  /**
   * The corpus entry the current passage was sourced from, or `null`
   * for engine-generated / custom-text runs. Only consumed for its
   * optional `display` annotation (pinyin → Chinese ruby overlay).
   */
  entry: CorpusEntry | null;
  /** Which physical layout to render on the on-screen keyboard. */
  keyboardLayout: KeyboardLayoutName;
  /** Active character keymap — `qwerty` / `colemak` / `dvorak`. Purely visual. */
  keymap: KeyMap;
  /** Active sound pack name. */
  keySoundPack: string;
  /** Live override from the inline picker. Mirrors the Settings preference. */
  onKeySoundPackChange: (name: string) => void;
  /** Active corpus channel — drives which source feeds the next passage. */
  corpusChannel: ChannelName;
  /** Live override from the inline picker. Persists to localStorage. */
  onCorpusChannelChange: (channel: ChannelName) => void;
  /** Active 小学年级 bucket for the pinyin channel. "all" = unfiltered. */
  pinyinGrade: PinyinGrade;
  /** Live override from the pinyin sub-picker. Persists to localStorage. */
  onPinyinGradeChange: (grade: PinyinGrade) => void;
  /** Active stage id for the trainer (kids) channel. */
  trainerStage: number;
  /** Live override from the trainer sub-picker. Persists to localStorage. */
  onTrainerStageChange: (stage: number) => void;
  /** Active practice mode for the trainer channel ("mixed" | "solo"). */
  trainerMode: TrainerMode;
  /** Live override from the trainer mode toggle. Persists to localStorage. */
  onTrainerModeChange: (mode: TrainerMode) => void;
  /** Currently-held keys, sourced from the shared `KeyEventBus`. */
  pressedKeys: Accessor<ReadonlySet<string>>;
  /** Receive the hidden input element so the parent can refocus on tap. */
  bindHiddenInput: (el: HTMLInputElement) => void;
  /** Fired when the user taps the stage on mobile — used to refocus the hidden input. */
  onStageTap: () => void;
  /** A printable character was committed via the soft-keyboard `beforeinput` path. */
  onSoftKeyboardChar: (char: string, timeStamp: number) => void;
  /** Backspace was committed via the soft-keyboard `beforeinput` path. */
  onSoftKeyboardBackspace: () => void;
  /** Render faint glyphs in place of invisible chars (space/tab/newline). */
  showWhitespace: boolean;
  /**
   * Fired when the user pastes text into the inline "custom test"
   * field and hits Run. The host installs it as a one-off passage on
   * the Session (no Library save) and restarts the run.
   */
  onCustomText: (text: string) => void;
}

/**
 * Practice screen: the typing surface, an optional on-screen keyboard
 * (subsumes the old per-letter heatmap), and the hidden-input mobile
 * soft-keyboard capture. Desktop input flows through the window-level
 * keydown handler installed by `createSessionBootstrap`.
 *
 * The hints area below the keyboard doubles as a tiny toolbar — source
 * and sound are the only mid-session controls inline here (layout +
 * keymap are set-once prefs that live on the Settings page).
 */
export function PracticeStage(props: PracticeStageProps): JSX.Element {
  const keyboard = createKeyboardToggle();
  const touchOnly = isTouchOnly();

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the tap-to-refocus handler is a mobile soft-keyboard hint, not a keyboard action. Desktop users interact via the window-level keydown handler, which works regardless of this main's focus.
    <main class="stage" onClick={() => props.onStageTap()}>
      <input
        ref={(el) => props.bindHiddenInput(el)}
        class="sr-only"
        type="text"
        inputMode="text"
        autocapitalize="none"
        autocorrect="off"
        autocomplete="off"
        spellcheck={false}
        tabindex={-1}
        aria-label="typing capture"
        value=""
        onInput={(event) => {
          event.currentTarget.value = "";
        }}
        onBeforeInput={(event) => {
          if (event.inputType === "deleteContentBackward") {
            event.preventDefault();
            props.onSoftKeyboardBackspace();
            return;
          }
          if (event.inputType === "insertText" && event.data) {
            event.preventDefault();
            for (const ch of event.data) {
              props.onSoftKeyboardChar(ch, performance.now());
            }
          }
        }}
      />
      <TypingArea
        typing={props.snap.typing}
        showWhitespace={props.showWhitespace}
        display={
          // Guard against a stale entry from the previous run: ruby
          // groups index into the entry's text, so the snapshot must
          // be on that same text or the indices misalign.
          props.entry?.display && props.entry.text === props.snap.typing.expected
            ? props.entry.display
            : undefined
        }
      />

      <Show when={props.snap.remainingSec !== null}>
        <output class="countdown" aria-label="time remaining">
          <span class="countdown__value">{Math.ceil(props.snap.remainingSec ?? 0)}</span>
          <span class="countdown__unit">s</span>
        </output>
      </Show>

      <Show when={keyboard.visible()}>
        <OnScreenKeyboard
          layout={props.keyboardLayout}
          keymap={props.keymap}
          plan={props.snap.plan}
          pressed={props.pressedKeys}
        />
      </Show>

      <Show when={props.snap.plan?.focus}>
        {(focus) => (
          <p class="focus-hint">
            weakest: <b>{focus()}</b>
          </p>
        )}
      </Show>

      <div class="practice-hints">
        <div class="practice-hints__row">
          <InlineSegRadio
            label="source"
            options={SOURCE_OPTIONS}
            value={props.corpusChannel}
            onChange={props.onCorpusChannelChange}
          />
          <InlineSegRadio
            label="sound"
            options={SOUND_OPTIONS}
            value={props.keySoundPack}
            onChange={props.onKeySoundPackChange}
          />
        </div>
        <Show when={props.corpusChannel === "pinyin"}>
          <div class="practice-hints__row">
            <InlineSegRadio
              label="grade"
              options={PINYIN_GRADE_OPTIONS}
              value={props.pinyinGrade}
              onChange={props.onPinyinGradeChange}
            />
          </div>
        </Show>
        <Show when={props.corpusChannel === "trainer"}>
          <div class="practice-hints__row practice-hints__row--scroll">
            <InlineSegRadio
              label="stage"
              options={TRAINER_STAGE_OPTIONS}
              value={props.trainerStage}
              onChange={props.onTrainerStageChange}
            />
          </div>
          <div class="practice-hints__row">
            <InlineSegRadio
              label="mode"
              options={TRAINER_MODE_OPTIONS}
              value={props.trainerMode}
              onChange={props.onTrainerModeChange}
            />
          </div>
        </Show>

        <div class="practice-hints__row">
          <p class="hint">
            <kbd>Tab</kbd> start with fresh text
          </p>
          <Show when={!touchOnly}>
            <button
              type="button"
              class="hint-button"
              aria-pressed={keyboard.visible()}
              onClick={() => keyboard.toggle()}
            >
              {keyboard.visible() ? "hide keyboard" : "show keyboard"}
            </button>
          </Show>
          <CustomTextInline onSubmit={props.onCustomText} />
        </div>
      </div>
    </main>
  );
}

/**
 * Inline "custom text" affordance — opens a small textarea overlay
 * where the user pastes a paragraph and hits Run. Distinct from the
 * Library because the text is NOT saved; it's a one-off for this run.
 * Pasting an article paragraph or a code snippet you want to practise
 * *right now* without committing it to the library.
 */
function CustomTextInline(props: { onSubmit: (text: string) => void }): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const [text, setText] = createSignal("");
  const submit = (): void => {
    const t = text().trim();
    if (t.length === 0) return;
    props.onSubmit(t);
    setText("");
    setOpen(false);
  };
  return (
    <Show
      when={open()}
      fallback={
        <button
          type="button"
          class="hint-button"
          aria-label="paste custom text"
          onClick={() => setOpen(true)}
        >
          custom text
        </button>
      }
    >
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: stop-propagation only; no behavior added. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: same rationale — onClick exists only to stopPropagation so the parent's refocus-the-typing-input handler doesn't steal focus from the textarea inside. No real interaction added. */}
      <div
        class="custom-text"
        onClick={(e) => {
          // The parent <main class="stage"> refocuses the hidden typing
          // input on every click — without this, every click inside the
          // panel (incl. clicking into the textarea, the Run button,
          // selecting text) would steal focus away from the textarea.
          e.stopPropagation();
        }}
      >
        <textarea
          class="field__input custom-text__input"
          placeholder="paste any text — runs once, not saved"
          value={text()}
          onInput={(e) => setText(e.currentTarget.value)}
          rows={3}
          autofocus
        />
        <div class="custom-text__actions">
          <button
            type="button"
            class="btn btn--primary"
            onClick={submit}
            disabled={text().trim().length === 0}
          >
            run
          </button>
          <button type="button" class="btn" onClick={() => setOpen(false)}>
            cancel
          </button>
        </div>
      </div>
    </Show>
  );
}
