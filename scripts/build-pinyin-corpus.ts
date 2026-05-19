/**
 * Build pinyin practice entries from public-domain Chinese corpora.
 *
 * Pipeline:
 *   1. Load the HSK 3.0 character list — a learning-ordered ladder we
 *      reuse as a proxy for 小学6年级 cumulative 字表. Each HSK level
 *      maps to the first grade in which a kid can reasonably read it
 *      (see HSK_TO_GRADE below).
 *   2. Load raw corpora — Traditional-Chinese JSON pulled from
 *      chinese-poetry/chinese-poetry, plus hand-written Simplified
 *      Chinese text files for proverbs and paraphrased fairy tales.
 *      Trad sources are converted to Simplified with opencc-js.
 *   3. Sentence-split, filter on length and HSK coverage, score by
 *      max HSK level → grade, convert to pinyin via pinyin-pro.
 *   4. Merge with hand-curated entries already in pinyin.json. Hand
 *      entries keep their ids; auto entries use a `py-a-` prefix and
 *      are rewritten on every run. Channel classifier in
 *      io/corpus/channel-meta.ts only checks for the `py-` prefix, so
 *      the new prefix is correctly classified.
 *
 * Determinism: same inputs → same output bytes. ids hash the sentence,
 * entries are sorted by (grade, id). Re-running on a clean tree should
 * leave the JSON unchanged.
 *
 * Run: pnpm tsx scripts/build-pinyin-corpus.ts
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as OpenCC from "opencc-js";
import { pinyin } from "pinyin-pro";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = join(__dirname, "..");
const RAW_DIR = join(__dirname, "data", "raw");
const HSK_CSV = join(__dirname, "data", "hsk30-characters.csv");
const OUT_JSON = join(REPO_ROOT, "src", "io", "corpus", "data", "pinyin.json");

/** Maximum HSK level a sentence may use to be eligible. */
const MAX_HSK_LEVEL = 7;

/**
 * HSK level → 小学年级 (1..6). HSK 3.0 is roughly aligned with the
 * 部编版语文 cumulative 识字 ladder but slightly compressed at the low
 * end (HSK1 ≈ pre-K, HSK6 ≈ 5–6年级). The bands below were chosen so
 * that:
 *   - G1 (~6岁): only the most basic 600字
 *   - G6 (~12岁): up to HSK 7 (~2200 chars), the upper edge of 小学
 * Sentences whose max char level exceeds 7 are dropped — they belong
 * in 初中 and we don't grade above G6.
 */
const HSK_TO_GRADE: Readonly<Record<number, number>> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
};

const SENTENCE_LEN_MIN = 6;
const SENTENCE_LEN_MAX = 32;
const MIN_CJK_RATIO = 0.7;

interface RawPinyin {
  id: string;
  characters: readonly string[];
  pinyin: readonly string[];
  toned?: readonly string[];
  license: string;
  grade?: number;
  source?: string;
}

interface PinyinFile {
  $schema?: string;
  _doc?: string;
  entries: RawPinyin[];
}

/* ───────────────────────── load 字表 ───────────────────────── */

function loadHskLevels(): Map<string, number> {
  const text = readFileSync(HSK_CSV, "utf8");
  const lines = text.split(/\r?\n/);
  const map = new Map<string, number>();
  // Header: hanzi_sc,hanzi_trad,pinyin,pinyin_style2,level,...
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (!row) continue;
    const cols = row.split(",");
    const hanzi = cols[0]?.trim();
    const level = Number.parseInt(cols[4] ?? "", 10);
    if (!hanzi || Number.isNaN(level)) continue;
    // A row may list multiple variant forms; we only need the first.
    for (const ch of hanzi) {
      if (!map.has(ch)) map.set(ch, level);
    }
  }
  return map;
}

/* ───────────────────────── sources ─────────────────────────── */

const trad2simp = OpenCC.Converter({ from: "t", to: "cn" });

interface RawDoc {
  /** Short tag baked into entry ids, e.g. "tang" / "sanzi". */
  tag: string;
  /** Plain-text license note. */
  license: string;
  /** Already in Simplified Chinese, sentence-by-sentence. */
  sentences: string[];
}

function loadJsonTrad<T>(file: string): T {
  return JSON.parse(readFileSync(join(RAW_DIR, file), "utf8")) as T;
}

function loadSanZiJing(): RawDoc {
  const data = loadJsonTrad<{ paragraphs: string[] }>("sanzijing.trad.json");
  // Each paragraph is "人之初，性本善，性相近，習相遠。" — one self-contained line.
  return {
    tag: "sanzi",
    license: "public domain (蒙学经典)",
    sentences: data.paragraphs.map((p) => trad2simp(p)),
  };
}

function loadDiZiGui(): RawDoc {
  const data = loadJsonTrad<{ content: { paragraphs: string[] }[] }>("dizigui.trad.json");
  // dizigui paragraphs use space-separated 3-char chunks ("弟子規 聖人訓 ...");
  // re-punctuate as "弟子规，圣人训，首孝弟，次谨信。" so they read as
  // real sentences and the engine sees proper word boundaries.
  const sentences: string[] = [];
  for (const ch of data.content) {
    for (const p of ch.paragraphs) {
      const chunks = p.split(/\s+/).filter((c) => c.length > 0);
      if (chunks.length === 0) continue;
      sentences.push(`${trad2simp(chunks.join("，"))}。`);
    }
  }
  return { tag: "dzg", license: "public domain (蒙学经典)", sentences };
}

function loadQianJiaShi(): RawDoc {
  // qianjiashi entries are short poems; each entry has paragraphs[].
  // Flatten paragraphs into individual couplets.
  const data = loadJsonTrad<unknown>("qianjiashi.trad.json");
  const sentences: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
    } else if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.paragraphs)) {
        for (const p of o.paragraphs as string[]) sentences.push(trad2simp(p));
      } else {
        for (const v of Object.values(o)) visit(v);
      }
    }
  };
  visit(data);
  return { tag: "qjs", license: "public domain (蒙学经典)", sentences };
}

function loadTangShi(): RawDoc {
  const data = loadJsonTrad<unknown>("tangshisanbaishou.trad.json");
  const sentences: string[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const n of node) visit(n);
    } else if (node && typeof node === "object") {
      const o = node as Record<string, unknown>;
      if (Array.isArray(o.paragraphs)) {
        for (const p of o.paragraphs as string[]) sentences.push(trad2simp(p));
      } else {
        for (const v of Object.values(o)) visit(v);
      }
    }
  };
  visit(data);
  return { tag: "tang", license: "public domain (唐诗)", sentences };
}

function loadPlainText(file: string, tag: string, license: string): RawDoc {
  const text = readFileSync(join(RAW_DIR, file), "utf8");
  const sentences: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    sentences.push(trimmed);
  }
  return { tag, license, sentences };
}

/* ───────────────────────── scoring ─────────────────────────── */

const CJK_RE = /\p{Script=Han}/u;

interface Scored {
  text: string;
  grade: number;
}

function scoreSentence(text: string, hsk: Map<string, number>): Scored | null {
  if (text.length < SENTENCE_LEN_MIN || text.length > SENTENCE_LEN_MAX) return null;
  let cjkCount = 0;
  let maxLevel = 0;
  for (const ch of text) {
    if (!CJK_RE.test(ch)) continue;
    cjkCount++;
    const level = hsk.get(ch);
    if (level === undefined) return null; // outside HSK 3.0 — too rare/literary
    if (level > maxLevel) maxLevel = level;
  }
  if (cjkCount === 0) return null;
  if (cjkCount / text.length < MIN_CJK_RATIO) return null;
  if (maxLevel === 0 || maxLevel > MAX_HSK_LEVEL) return null;
  const grade = HSK_TO_GRADE[maxLevel];
  if (grade === undefined) return null;
  return { text, grade };
}

/* ───────────────────────── pinyin conversion ───────────────── */

interface Converted {
  characters: string[];
  pinyin: string[];
  toned: string[];
}

/**
 * Convert one sentence to parallel characters/pinyin/toned arrays.
 *
 * pinyin-pro returns one array cell per input codepoint when
 * `type: "array"`. For CJK chars the cell is the pinyin syllable; for
 * everything else (punctuation, latin chars) it's the codepoint
 * unchanged. We mirror the codepoint into characters[], emit an empty
 * pinyin cell for non-CJK (so the engine doesn't try to type it), and
 * keep toned in lockstep.
 */
function toPinyin(text: string): Converted | null {
  const plain = pinyin(text, { type: "array", toneType: "none", v: true }) as string[];
  const toned = pinyin(text, { type: "array", toneType: "symbol", v: true }) as string[];
  const chars = [...text];
  if (plain.length !== chars.length || toned.length !== chars.length) return null;

  const outChars: string[] = [];
  const outPy: string[] = [];
  const outToned: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i] as string;
    const py = (plain[i] ?? "").toLowerCase();
    const tn = toned[i] ?? "";
    if (CJK_RE.test(ch)) {
      // pinyin-pro should have produced lowercase a-z (no tones). If it
      // gave us back the same char or something non-ASCII, the lookup
      // failed — drop this sentence.
      if (!/^[a-z]+$/.test(py)) return null;
      outChars.push(ch);
      outPy.push(py);
      outToned.push(tn);
    } else if (/\s/.test(ch)) {
      // skip whitespace entirely
      continue;
    } else {
      // punctuation / latin — display-only cell
      outChars.push(ch);
      outPy.push("");
      outToned.push("");
    }
  }
  if (outPy.every((p) => p === "")) return null;
  return { characters: outChars, pinyin: outPy, toned: outToned };
}

/* ───────────────────────── main ────────────────────────────── */

function shortHash(s: string): string {
  return createHash("sha1").update(s).digest("hex").slice(0, 8);
}

function readExisting(): PinyinFile {
  return JSON.parse(readFileSync(OUT_JSON, "utf8")) as PinyinFile;
}

function main(): void {
  const hsk = loadHskLevels();
  console.log(`HSK chars loaded: ${hsk.size}`);

  const docs: RawDoc[] = [
    loadSanZiJing(),
    loadDiZiGui(),
    // 千字文 is too literary for HSK 1–7 — every line drops. Skip.
    loadQianJiaShi(),
    loadTangShi(),
    loadPlainText("proverbs.txt", "prov", "public domain (谚语)"),
    loadPlainText("fairy-tales.txt", "tale", "public domain (改写自经典童话)"),
  ];

  const seen = new Set<string>();
  const newEntries: RawPinyin[] = [];
  const stats: Record<string, { kept: number; dropped: number; byGrade: number[] }> = {};

  for (const doc of docs) {
    stats[doc.tag] = { kept: 0, dropped: 0, byGrade: [0, 0, 0, 0, 0, 0, 0] };
    for (const raw of doc.sentences) {
      const scored = scoreSentence(raw, hsk);
      if (!scored) {
        stats[doc.tag]!.dropped++;
        continue;
      }
      if (seen.has(scored.text)) continue;
      seen.add(scored.text);
      const conv = toPinyin(scored.text);
      if (!conv) {
        stats[doc.tag]!.dropped++;
        continue;
      }
      const id = `py-a-${doc.tag}-g${scored.grade}-${shortHash(scored.text)}`;
      newEntries.push({
        id,
        characters: conv.characters,
        pinyin: conv.pinyin,
        toned: conv.toned,
        license: doc.license,
        grade: scored.grade,
        source: doc.tag,
      });
      stats[doc.tag]!.kept++;
      stats[doc.tag]!.byGrade[scored.grade]!++;
    }
  }

  // Preserve hand-curated entries (anything without the `py-a-` prefix).
  // Migrate legacy entries to grade=1 if they don't carry a grade yet —
  // the existing 20 seed sentences are all kindergarten-level.
  const existing = readExisting();
  const hand: RawPinyin[] = existing.entries
    .filter((e) => !e.id.startsWith("py-a-"))
    .map((e) => ({
      ...e,
      grade: e.grade ?? 1,
    }));

  const all = [...hand, ...newEntries].sort((a, b) => {
    const ga = a.grade ?? 0;
    const gb = b.grade ?? 0;
    if (ga !== gb) return ga - gb;
    return a.id.localeCompare(b.id);
  });

  const out: PinyinFile = {
    $schema: existing.$schema,
    _doc: existing._doc,
    entries: all,
  };

  writeFileSync(OUT_JSON, serialize(out));

  console.log(`\nWrote ${all.length} entries (${hand.length} hand + ${newEntries.length} auto)`);
  console.log("\nPer-source:");
  for (const [tag, s] of Object.entries(stats)) {
    const grades = s.byGrade
      .map((n, i) => (i > 0 && n > 0 ? `G${i}:${n}` : null))
      .filter(Boolean)
      .join(" ");
    console.log(`  ${tag.padEnd(8)} kept=${s.kept}  dropped=${s.dropped}  ${grades}`);
  }
  const byGrade = [0, 0, 0, 0, 0, 0, 0];
  for (const e of all) {
    if (e.grade) byGrade[e.grade] = (byGrade[e.grade] ?? 0) + 1;
  }
  console.log("\nTotal per grade:", byGrade.slice(1).map((n, i) => `G${i + 1}:${n}`).join("  "));
}

/**
 * Pretty-print pinyin.json keeping each entry on a single line. The
 * existing file uses that style and it's much easier to scan in PRs
 * than a fully-indented form would be.
 */
function serialize(file: PinyinFile): string {
  const lines: string[] = ["{"];
  if (file.$schema) lines.push(`  "$schema": ${JSON.stringify(file.$schema)},`);
  if (file._doc) lines.push(`  "_doc": ${JSON.stringify(file._doc)},`);
  lines.push(`  "entries": [`);
  for (let i = 0; i < file.entries.length; i++) {
    const e = file.entries[i] as RawPinyin;
    const last = i === file.entries.length - 1;
    lines.push(`    ${JSON.stringify(e)}${last ? "" : ","}`);
  }
  lines.push("  ]");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}

main();
