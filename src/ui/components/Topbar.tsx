import type { JSX } from "solid-js";
import { Show } from "solid-js";
import type { SessionSnapshot } from "../../engine/session";

export interface TopbarProps {
  snap: SessionSnapshot;
  /** Show the live-metrics block only when the practice view is active. */
  showLive: boolean;
  onHomeClick: () => void;
  /** Switch to kids-mode tree. */
  onKidsMode: () => void;
}

/** Application top bar: brand button + (in practice view) live WPM / accuracy / mode. */
export function Topbar(props: TopbarProps): JSX.Element {
  return (
    <header class="topbar">
      <button
        type="button"
        class="logo logo--button"
        onClick={() => props.onHomeClick()}
        aria-label="home"
      >
        <BrandMark />
        <b>TYPE</b>
        <small>.review</small>
      </button>
      <Show when={props.showLive}>
        <div class="live">
          <span class="live__stat">{props.snap.liveMetrics.netWpm} wpm</span>
          <span class="live__stat">{props.snap.liveMetrics.accuracy}%</span>
          <span class="live__mode">{props.snap.mode}</span>
        </div>
      </Show>
      <button
        type="button"
        class="topbar__kids"
        onClick={() => props.onKidsMode()}
        aria-label="切换到儿童模式"
        title="切换到儿童模式"
      >
        <KidsStarMark />
        <span class="topbar__kids__label">kids</span>
      </button>
    </header>
  );
}

/**
 * Same keyboard outline used by the favicon + apple-touch icon — bundled
 * inline so it inherits `currentColor` from the surrounding `.logo b`
 * (the accent-coloured "TYPE" word), and sized via 1em so it scales with
 * the logo's font size across the responsive type scale.
 */
/** Five-point star matching the KidsApp brand. */
function KidsStarMark(): JSX.Element {
  return (
    <svg
      class="topbar__kids__star"
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      aria-hidden="true"
    >
      <path
        d="M12 3 L14.5 9.5 L21.5 10 L16.2 14.5 L18 21 L12 17.5 L6 21 L7.8 14.5 L2.5 10 L9.5 9.5 Z"
        fill="currentColor"
        stroke="currentColor"
        stroke-width="1.4"
        stroke-linejoin="round"
      />
    </svg>
  );
}

function BrandMark(): JSX.Element {
  return (
    <svg
      class="logo__mark"
      viewBox="0 0 24 24"
      width="1.15em"
      height="1.15em"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h.01" />
      <path d="M10 8h.01" />
      <path d="M14 8h.01" />
      <path d="M18 8h.01" />
      <path d="M8 12h.01" />
      <path d="M12 12h.01" />
      <path d="M16 12h.01" />
      <path d="M7 16h10" />
    </svg>
  );
}
