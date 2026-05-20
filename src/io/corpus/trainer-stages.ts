/**
 * Finger-pair beginner curriculum, inspired by
 * timbornemann/Tippsy-Tries-Typing (MIT). Stages start with the home-row
 * index pair `f j` and progressively unlock new finger pairs across the
 * three rows, then layer on punctuation, Shift, and the number row.
 *
 * Each stage's `chars` is the cumulative pool of typeable characters
 * (passed to `generatePseudoWords` as `Filter.allowed`). `newChars[0]`
 * is the focus letter — the source over-represents it so the kid
 * actually drills the new motor pattern instead of coasting on letters
 * they already know.
 *
 * Stage 4 pairs the left pinky `a` with the already-learned right ring
 * `l` instead of the standard `a ;` — semicolons aren't kid-friendly,
 * and pairing with a known key keeps the rhythm rather than introducing
 * two new fingers at once. The right pinky shows up later, in the
 * punctuation stage.
 */

export interface TrainerStage {
  /** 1-based stage number — used as the persisted selector. */
  readonly id: number;
  /** Short label shown in the sub-picker (e.g. "fj", "qp"). */
  readonly label: string;
  /** Newly-introduced keys for this stage — primarily for the focus letter. */
  readonly newChars: readonly string[];
  /**
   * Cumulative pool of allowed characters, including spaces. Always includes
   * whitespace so the generator can produce multi-word passages.
   */
  readonly chars: readonly string[];
}

const HOME = ["a", "s", "d", "f", "g", "h", "j", "k", "l"] as const;
const TOP = ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"] as const;
const BOT = ["z", "x", "c", "v", "b", "n", "m"] as const;

const stage = (id: number, label: string, newChars: string[], chars: string[]): TrainerStage => ({
  id,
  label,
  newChars,
  // Whitespace is implicit in every alphabet — without it `generatePseudoWords`
  // would produce one long unbroken string of letters.
  chars: [...chars, " "],
});

/**
 * Home-row pair builds. Each stage adds two mirror-finger keys; stage 4
 * deliberately introduces only the left pinky (paired with the already-
 * known `l`) so we don't double up new motor patterns.
 */
const homeRow: TrainerStage[] = [
  stage(1, "fj", ["f", "j"], ["f", "j"]),
  stage(2, "dk", ["d", "k"], ["f", "j", "d", "k"]),
  stage(3, "sl", ["s", "l"], ["f", "j", "d", "k", "s", "l"]),
  // Left pinky `a` joins the home row — paired with `l` (right ring,
  // already practised) so the new motor pattern stands out alone.
  stage(4, "al", ["a"], ["f", "j", "d", "k", "s", "l", "a"]),
  stage(5, "gh", ["g", "h"], [...HOME]),
];

/** Top-row pairs, mirroring fingers down from the home row. */
const topRow: TrainerStage[] = [
  stage(6, "ru", ["r", "u"], [...HOME, "r", "u"]),
  stage(7, "ei", ["e", "i"], [...HOME, "r", "u", "e", "i"]),
  stage(8, "wo", ["w", "o"], [...HOME, "r", "u", "e", "i", "w", "o"]),
  stage(9, "qp", ["q", "p"], [...HOME, "r", "u", "e", "i", "w", "o", "q", "p"]),
  stage(10, "ty", ["t", "y"], [...HOME, ...TOP]),
];

/** Bottom-row pairs. */
const botRow: TrainerStage[] = [
  stage(11, "vn", ["v", "n"], [...HOME, ...TOP, "v", "n"]),
  stage(12, "bm", ["b", "m"], [...HOME, ...TOP, "v", "n", "b", "m"]),
  stage(13, "cx", ["c", "x"], [...HOME, ...TOP, "v", "n", "b", "m", "c", "x"]),
  stage(14, "z", ["z"], [...HOME, ...TOP, ...BOT]),
];

/**
 * Stage 15 layers basic punctuation in. `generatePseudoWords` treats
 * every member of `allowed` as a glyph to emit, so commas and periods
 * sprinkle naturally through the generated words.
 */
const punctuation: TrainerStage = stage(
  15,
  "punct",
  [".", ",", "?", "!"],
  [...HOME, ...TOP, ...BOT, ".", ",", "?", "!"],
);

/**
 * Stage 16 mirrors the lowercase alphabet to uppercase + the shifted
 * forms of the punctuation set. The on-screen keyboard hints Shift via
 * a separate code path; here we just emit a wider pool that includes
 * the case-paired letters.
 */
const shifted: TrainerStage = stage(
  16,
  "Shift",
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  [...HOME, ...TOP, ...BOT, ".", ",", "?", "!", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")],
);

/**
 * Stage 17 unlocks the number row — kept last because numeric input is
 * a thumb-up reach for both pinkies and middle fingers, and beginners
 * benefit more from solid letter coverage first.
 */
const numbers: TrainerStage = stage(
  17,
  "1-0",
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  [
    ...HOME,
    ...TOP,
    ...BOT,
    ".",
    ",",
    "?",
    "!",
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "0",
  ],
);

export const TRAINER_STAGES: readonly TrainerStage[] = [
  ...homeRow,
  ...topRow,
  ...botRow,
  punctuation,
  shifted,
  numbers,
];

/** Look up a stage by 1-based id, falling back to stage 1 for any unknown id. */
export function trainerStageById(id: number): TrainerStage {
  return TRAINER_STAGES.find((s) => s.id === id) ?? (TRAINER_STAGES[0] as TrainerStage);
}
