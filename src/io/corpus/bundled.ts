/**
 * Production wiring for the bundled corpus sources.
 *
 * `import.meta.glob` is a Vite feature — it inlines matching files at build
 * time. With `eager: true`, the modules are loaded synchronously and the
 * resulting record has the parsed JSON. This file is the ONLY place that
 * touches the Vite-specific API; everything else operates on plain
 * `RawQuote[]` / `RawCode[]` arrays so unit tests can inject their own.
 */

import type { CorpusSource } from "../../engine/corpus";
import { createCodeSource, type RawCode } from "./code";
import { createPinyinSource, type PinyinSourceOptions, type RawPinyin } from "./pinyin";
import { createQuotesSource, type RawQuote } from "./quotes";

interface QuotesFile {
  entries: RawQuote[];
}

interface PinyinFile {
  entries: RawPinyin[];
}

import pinyinJson from "./data/pinyin.json";
// Top-level static import — Vite inlines the JSON into the bundle.
import quotesJson from "./data/quotes.json";

const quotesData = quotesJson as QuotesFile;
const pinyinData = pinyinJson as PinyinFile;

const codeModules = import.meta.glob<{ default: RawCode }>("./data/code/*.json", {
  eager: true,
});
const codeData: RawCode[] = Object.values(codeModules).map((m) => m.default);

export const bundledQuotes: CorpusSource = createQuotesSource(quotesData.entries);
export const bundledCode: CorpusSource = createCodeSource(codeData);

/**
 * Factory for the pinyin source. Unlike the other bundled sources, this
 * one consults a live grade accessor on every pick so the sub-picker on
 * the practice page can narrow the pool to a 小学年级 bucket without
 * rebuilding the source.
 */
export function createBundledPinyin(opts: PinyinSourceOptions = {}): CorpusSource {
  return createPinyinSource(pinyinData.entries, opts);
}

/**
 * Static, grade-unaware pinyin source. Retained for any caller that
 * doesn't need the sub-picker (tests, fallback wiring). The App uses
 * `createBundledPinyin(...)` so it can pipe the live grade signal in.
 */
export const bundledPinyin: CorpusSource = createPinyinSource(pinyinData.entries);
