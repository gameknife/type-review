import type { JSX } from "solid-js";
import type { SessionSnapshot } from "../../engine/session";

export interface KidsTopbarProps {
  snap: SessionSnapshot;
  /** Click target → go back to grown-up mode. */
  onExit: () => void;
}

/**
 * Cute top bar for kids mode. Three pill-shaped stat cards:
 *   - 进度 (progress %): typed chars / total chars
 *   - 时间 (time): elapsed mm:ss for the current run
 *   - 正确率 (accuracy %): live snapshot accuracy
 *
 * The brand "打字小星球" doubles as the exit button — tap to return to
 * the regular UI. We don't use a separate "exit" affordance because the
 * page is intentionally minimal; the brand is the only navigation.
 */
export function KidsTopbar(props: KidsTopbarProps): JSX.Element {
  const progress = (): number => {
    const total = props.snap.typing.expected.length;
    if (total === 0) return 0;
    return Math.min(100, Math.round((props.snap.typing.pos / total) * 100));
  };

  const elapsedClock = (): string => {
    const ms = Math.max(0, Math.floor(props.snap.elapsedMs));
    const total = Math.floor(ms / 1000);
    const mm = String(Math.floor(total / 60)).padStart(2, "0");
    const ss = String(total % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  return (
    <header class="kid-topbar">
      <button
        type="button"
        class="kid-brand"
        onClick={() => props.onExit()}
        aria-label="返回普通模式"
        title="返回普通模式"
      >
        <svg class="kid-brand__star" viewBox="0 0 32 32" aria-hidden="true">
          <path
            d="M16 3 L20 12 L30 13 L22.5 19.5 L25 29 L16 24 L7 29 L9.5 19.5 L2 13 L12 12 Z"
            stroke-linejoin="round"
            stroke-width="2"
          />
        </svg>
        <span class="kid-brand__title">打字小星球</span>
      </button>
      <div class="kid-stats">
        <div class="kid-stat kid-stat--progress">
          <svg viewBox="0 0 24 24" class="kid-stat__icon" aria-hidden="true">
            <path
              d="M12 2 L14.6 8.6 L21.6 9.2 L16.2 13.8 L17.8 20.6 L12 17 L6.2 20.6 L7.8 13.8 L2.4 9.2 L9.4 8.6 Z"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
          </svg>
          <span class="kid-stat__label">进度</span>
          <span class="kid-stat__value">{progress()}%</span>
        </div>
        <div class="kid-stat kid-stat--time">
          <svg viewBox="0 0 24 24" class="kid-stat__icon" aria-hidden="true">
            <circle cx="12" cy="13" r="8" stroke-width="1.8" fill="none" />
            <path d="M12 9 V13 L15 15" stroke-width="1.8" stroke-linecap="round" fill="none" />
            <path d="M9 3 H15" stroke-width="1.8" stroke-linecap="round" />
          </svg>
          <span class="kid-stat__label">时间</span>
          <span class="kid-stat__value">{elapsedClock()}</span>
        </div>
        <div class="kid-stat kid-stat--acc">
          <svg viewBox="0 0 24 24" class="kid-stat__icon" aria-hidden="true">
            <path
              d="M12 21 C 4 16 2 11 4.5 7.5 C 7 4 11 5.5 12 8 C 13 5.5 17 4 19.5 7.5 C 22 11 20 16 12 21 Z"
              stroke-width="1.8"
              stroke-linejoin="round"
            />
          </svg>
          <span class="kid-stat__label">正确率</span>
          <span class="kid-stat__value">{props.snap.liveMetrics.accuracy}%</span>
        </div>
      </div>
    </header>
  );
}
