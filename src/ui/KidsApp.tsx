import type { JSX } from "solid-js";
import { createSignal, For, onCleanup, Show } from "solid-js";
import type { CorpusEntry } from "../engine/corpus";
import type { ProfileStore } from "../io";
import {
  createBundledPinyin,
  createCompositeCorpus,
  createCorpusSessionAdapter,
  createKeyEventBus,
  createProfileStore,
  createTrainerSource,
  NoPersistStore,
  TRAINER_STAGES,
} from "../io";
import type { LoadBanner, SaveBanner } from "./components/Banners";
import { Banners } from "./components/Banners";
import { createCrossTab } from "./hooks/use-cross-tab";
import { createKeySounds } from "./hooks/use-key-sounds";
import { createPinyinGrade } from "./hooks/use-pinyin-grade";
import { createPressedKeys } from "./hooks/use-pressed-keys";
import { createSessionBootstrap } from "./hooks/use-session-bootstrap";
import { createSessionHandlers } from "./hooks/use-session-handlers";
import { createSnapshotView } from "./hooks/use-snapshot";
import { createTrainerMode } from "./hooks/use-trainer-mode";
import { createTrainerStage } from "./hooks/use-trainer-stage";
import { KidsKeyboard } from "./kids/KidsKeyboard";
import { KidsScenery } from "./kids/KidsScenery";
import { KidsTopbar } from "./kids/KidsTopbar";
import { logFailure } from "./log";
import { TypingArea } from "./TypingArea";
import type { ThemeController } from "./theme";

const CROSS_TAB_CHANNEL = "type-review";

type Channel = "trainer" | "pinyin";

const TRAINER_STAGE_LABELS = TRAINER_STAGES.map((s) => ({ value: s.id, label: s.label }));
const PINYIN_GRADE_LABELS: readonly { value: "all" | 1 | 2 | 3 | 4 | 5 | 6; label: string }[] = [
  { value: "all", label: "全部" },
  { value: 1, label: "一" },
  { value: 2, label: "二" },
  { value: 3, label: "三" },
  { value: 4, label: "四" },
  { value: 5, label: "五" },
  { value: 6, label: "六" },
];
const FONT_OPTIONS: readonly { value: "sm" | "md" | "lg"; label: string }[] = [
  { value: "sm", label: "小" },
  { value: "md", label: "中" },
  { value: "lg", label: "大" },
];

export interface KidsAppProps {
  /** Shared theme controller — used to exit back to grown-up mode. */
  themeController: ThemeController;
  /** Optional store override for tests. Production goes through IndexedDB. */
  store?: ProfileStore;
}

/**
 * Kids-mode app shell. Owns its own session lifecycle so the regular
 * `App` component stays untouched and the two trees can be swapped at
 * the root without entangling state.
 *
 * Only two corpus channels are wired up: `trainer` (finger-pair
 * curriculum, default) and `pinyin` (中文 ruby overlay). The page has no
 * stats, no settings, no library — just typing.
 */
export function KidsApp(props: KidsAppProps): JSX.Element {
  const storePromise: Promise<ProfileStore> = props.store
    ? Promise.resolve(props.store)
    : createProfileStore();

  const view = createSnapshotView();
  const crossTab = createCrossTab(CROSS_TAB_CHANNEL);

  const keyBus = createKeyEventBus();
  const pressedKeys = createPressedKeys(keyBus);
  const keySounds = createKeySounds(keyBus);
  onCleanup(() => keyBus.detach());

  const pinyinGrade = createPinyinGrade();
  const trainerStage = createTrainerStage();
  const trainerMode = createTrainerMode();

  const [channel, setChannel] = createSignal<Channel>("trainer");
  const [fontSize, setFontSize] = createSignal<"sm" | "md" | "lg">("md");

  // Kid mode runs trainer or pinyin exclusively. Composite still drives
  // the picker so `corpusAdapter` exposes the same Session-friendly
  // shape the bootstrap expects; "auto" is dropped from the list since
  // kids never see it.
  const corpus = createCompositeCorpus({
    channels: [
      {
        name: "trainer",
        source: createTrainerSource({
          getStageId: () => trainerStage.stageId(),
          getMode: () => trainerMode.mode(),
          rng: Math.random,
        }),
        auto: false,
      },
      {
        name: "pinyin",
        source: createBundledPinyin({ getGrade: () => pinyinGrade.grade() }),
        auto: false,
      },
    ],
    activeChannel: () => channel(),
  });
  const [currentEntry, setCurrentEntry] = createSignal<CorpusEntry | null>(null);
  const corpusAdapter = createCorpusSessionAdapter(corpus, Math.random, {
    onEntryPicked: setCurrentEntry,
  });

  const [loadBanner, setLoadBanner] = createSignal<LoadBanner>(null);
  const [saveBanner, setSaveBanner] = createSignal<SaveBanner>(null);
  const [runCrashed, setRunCrashed] = createSignal(false);
  // `router`-shaped shim — the kid app is single-page (one stage, no
  // results screen), so navigation is mocked. Tab still restarts the
  // run via the regular handler chain.
  const router = { navigate: (_to: string): void => {} };

  let session!: import("../engine/session").Session;
  let store!: ProfileStore;
  let disposed = false;
  let hiddenInputRef: HTMLInputElement | undefined;
  onCleanup(() => {
    disposed = true;
  });

  const persist = (): void => {
    store
      .save(session.profile)
      .then(() => {
        if (!disposed && saveBanner() === "save-failed") {
          setSaveBanner(null);
        }
        crossTab.notify();
      })
      .catch((err: unknown) => {
        logFailure("save", err, { resultsCount: session.profile.results.length });
        if (!disposed) setSaveBanner("save-failed");
      });
  };

  const restart = (): void => {
    session.start();
    view.syncNow();
  };

  const handleChannelChange = (next: Channel): void => {
    if (next === channel()) return;
    setChannel(next);
    if (session) restart();
  };
  const handlePinyinGrade: typeof pinyinGrade.setGrade = (g) => {
    if (g === pinyinGrade.grade()) return;
    pinyinGrade.setGrade(g);
    if (session && channel() === "pinyin") restart();
  };
  const handleStage = (id: number): void => {
    if (id === trainerStage.stageId()) return;
    trainerStage.setStageId(id);
    if (session && channel() === "trainer") restart();
  };
  const handleMode = (m: typeof trainerMode.mode extends () => infer T ? T : never): void => {
    if (m === trainerMode.mode()) return;
    trainerMode.setMode(m);
    if (session && channel() === "trainer") restart();
  };

  const { onChar, onBackspace, onRestart } = createSessionHandlers({
    getSession: () => session,
    view,
    // After a run completes the engine produces a result snapshot — but
    // there's no results screen here, so just immediately start the
    // next passage. `router.navigate("results")` is a no-op above,
    // which is exactly what we want.
    router,
    setRunCrashed,
  });

  createSessionBootstrap({
    storePromise,
    fallbackStore: () => new NoPersistStore(),
    bus: keyBus,
    setLoadBanner,
    adaptiveSource: corpusAdapter.adaptiveSource,
    benchmarkSource: corpusAdapter.benchmarkSource,
    onReady: (deps) => {
      session = deps.session;
      store = deps.store;
      view.attach(() => session.snapshot());
    },
    onResult: () => {
      persist();
      // Auto-advance: completed runs immediately roll into the next
      // passage so the kid never lands on a blank "results" screen.
      // Tiny defer so the snapshot for the just-finished run paints once.
      setTimeout(() => {
        if (!disposed) restart();
      }, 350);
    },
    input: {
      onChar,
      onBackspace,
      onRestart,
      onConfirm: () => restart(),
      onError: (err) => logFailure("input-callback", err),
    },
    enabled: {
      isEnabled: () => !runCrashed(),
      shouldConfirm: () => false,
    },
  });

  return (
    <Show when={view.snapshot()} fallback={<div class="loading kids-loading">loading…</div>}>
      {(snap) => (
        <div class={`kids-app kids-app--font-${fontSize()}`}>
          <KidsScenery />
          <KidsTopbar snap={snap()} onExit={() => exitKids(props.themeController)} />
          <Banners loadBanner={loadBanner} saveBanner={saveBanner} runCrashed={runCrashed} />
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: tap-to-focus only for the mobile soft-keyboard hidden input — desktop typing flows through the window keydown handler. */}
          <main class="kids-stage" onClick={() => hiddenInputRef?.focus()}>
            <input
              ref={(el) => (hiddenInputRef = el)}
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
                  onBackspace();
                  return;
                }
                if (event.inputType === "insertText" && event.data) {
                  event.preventDefault();
                  for (const ch of event.data) {
                    onChar(ch, performance.now());
                  }
                }
              }}
            />

            <div class="kids-card">
              <TypingArea
                typing={snap().typing}
                showWhitespace={false}
                display={
                  currentEntry()?.display && currentEntry()?.text === snap().typing.expected
                    ? currentEntry()?.display
                    : undefined
                }
              />
            </div>

            <KidsKeyboard plan={snap().plan} pressed={pressedKeys} />

            <div class="kids-toolbar">
              <ChannelToggle value={channel()} onChange={handleChannelChange} />

              <Show when={channel() === "trainer"}>
                <KidPicker
                  label="阶段"
                  options={TRAINER_STAGE_LABELS}
                  value={trainerStage.stageId()}
                  onChange={handleStage}
                />
                <KidPicker
                  label="模式"
                  options={[
                    { value: "mixed", label: "混合" },
                    { value: "solo", label: "单练" },
                  ]}
                  value={trainerMode.mode()}
                  onChange={handleMode}
                />
              </Show>

              <Show when={channel() === "pinyin"}>
                <KidPicker
                  label="年级"
                  options={PINYIN_GRADE_LABELS}
                  value={pinyinGrade.grade()}
                  onChange={handlePinyinGrade}
                />
              </Show>

              <KidPicker
                label="字体"
                options={FONT_OPTIONS}
                value={fontSize()}
                onChange={setFontSize}
              />

              <KidPicker
                label="声音"
                options={[
                  { value: "off", label: "静音" },
                  { value: "soft", label: "轻柔" },
                  { value: "mechanical", label: "机械" },
                ]}
                value={keySounds.packName()}
                onChange={keySounds.setPackName}
              />
            </div>
          </main>
        </div>
      )}
    </Show>
  );
}

function exitKids(theme: ThemeController): void {
  // Restore to OS default. The user can pick a specific theme later
  // from Settings; "light" is a sensible neutral landing for now.
  theme.setTheme("light");
}

function ChannelToggle(props: { value: Channel; onChange: (next: Channel) => void }): JSX.Element {
  const tabs: readonly { value: Channel; label: string; emoji: string }[] = [
    { value: "trainer", label: "字母", emoji: "🅰" },
    { value: "pinyin", label: "拼音", emoji: "汉" },
  ];
  return (
    <div class="kid-tabs" role="tablist" aria-label="练习内容">
      <For each={tabs}>
        {(tab) => (
          <button
            type="button"
            class="kid-tab"
            classList={{ "kid-tab--active": props.value === tab.value }}
            role="tab"
            aria-selected={props.value === tab.value}
            onClick={() => props.onChange(tab.value)}
          >
            <span class="kid-tab__glyph" aria-hidden="true">
              {tab.emoji}
            </span>
            <span class="kid-tab__label">{tab.label}</span>
          </button>
        )}
      </For>
    </div>
  );
}

interface KidPickerProps<T> {
  label: string;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
}

function KidPicker<T>(props: KidPickerProps<T>): JSX.Element {
  return (
    <label class="kid-picker">
      <span class="kid-picker__label">{props.label}</span>
      <span class="kid-picker__select">
        <select
          class="kid-picker__native"
          value={String(props.value)}
          onChange={(event) => {
            const raw = event.currentTarget.value;
            const match = props.options.find((o) => String(o.value) === raw);
            if (match) props.onChange(match.value);
          }}
        >
          <For each={props.options}>
            {(opt) => <option value={String(opt.value)}>{opt.label}</option>}
          </For>
        </select>
        <svg viewBox="0 0 20 20" class="kid-picker__chevron" aria-hidden="true">
          <path d="M5 8 L10 13 L15 8" fill="none" stroke-width="2" stroke-linecap="round" />
        </svg>
      </span>
    </label>
  );
}
