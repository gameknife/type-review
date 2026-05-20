import type { JSX } from "solid-js";

/**
 * Inline SVG scenery for the kids page. Everything drawn vector — no
 * raster textures — so the assets are tiny, scale crisp on every DPI,
 * and the palette is steerable from CSS variables (each shape pulls
 * its fill from a `--kid-*` token via `currentColor` or explicit refs).
 *
 * The four pieces live as separate components so the layout can place
 * them at different corners of the page without re-laying-out a single
 * giant background SVG.
 */

/** Cute round cloud with a friendly face — used twice in the sky. */
export function Cloud(props: { class?: string; flip?: boolean }): JSX.Element {
  return (
    <svg
      class={`kid-svg ${props.class ?? ""}`}
      classList={{ "kid-svg--flip": props.flip === true }}
      viewBox="0 0 120 70"
      aria-hidden="true"
    >
      <g class="kid-cloud">
        <ellipse cx="35" cy="42" rx="22" ry="20" />
        <ellipse cx="62" cy="34" rx="26" ry="24" />
        <ellipse cx="92" cy="44" rx="20" ry="18" />
        <ellipse cx="60" cy="56" rx="40" ry="14" />
      </g>
      <g class="kid-cloud__face">
        <circle cx="52" cy="36" r="2.2" />
        <circle cx="72" cy="36" r="2.2" />
        <path d="M 56 44 Q 62 48 68 44" fill="none" stroke-width="2" stroke-linecap="round" />
        <circle cx="46" cy="44" r="2.6" class="kid-cloud__blush" />
        <circle cx="78" cy="44" r="2.6" class="kid-cloud__blush" />
      </g>
    </svg>
  );
}

/** Stylised tree with a rounded leafy canopy. */
export function Tree(props: { class?: string }): JSX.Element {
  return (
    <svg class={`kid-svg ${props.class ?? ""}`} viewBox="0 0 80 140" aria-hidden="true">
      <rect class="kid-tree__trunk" x="34" y="80" width="12" height="50" rx="3" />
      <circle class="kid-tree__leaves" cx="40" cy="50" r="34" />
      <circle class="kid-tree__leaves kid-tree__leaves--hi" cx="28" cy="42" r="20" />
      <circle class="kid-tree__leaves kid-tree__leaves--hi" cx="54" cy="44" r="18" />
      <circle class="kid-tree__dot" cx="30" cy="56" r="2.2" />
      <circle class="kid-tree__dot" cx="48" cy="36" r="2.2" />
      <circle class="kid-tree__dot" cx="54" cy="60" r="2.2" />
    </svg>
  );
}

/** Mascot star with a smiley face — anchors the bottom bar. */
export function StarMascot(props: { class?: string }): JSX.Element {
  return (
    <svg class={`kid-svg ${props.class ?? ""}`} viewBox="0 0 100 100" aria-hidden="true">
      <path
        class="kid-star__body"
        d="M50 8 L62 38 L94 42 L70 64 L78 96 L50 80 L22 96 L30 64 L6 42 L38 38 Z"
        stroke-linejoin="round"
        stroke-width="3"
      />
      <circle class="kid-star__eye" cx="40" cy="50" r="3.2" />
      <circle class="kid-star__eye" cx="62" cy="50" r="3.2" />
      <path
        class="kid-star__mouth"
        d="M 40 62 Q 51 72 62 62"
        fill="none"
        stroke-width="3"
        stroke-linecap="round"
      />
      <circle class="kid-star__blush" cx="32" cy="62" r="3" />
      <circle class="kid-star__blush" cx="70" cy="62" r="3" />
    </svg>
  );
}

/** Grassy hill with a little flag on top. */
export function HillFlag(props: { class?: string }): JSX.Element {
  return (
    <svg class={`kid-svg ${props.class ?? ""}`} viewBox="0 0 200 140" aria-hidden="true">
      <path class="kid-hill" d="M -20 140 Q 100 30 220 140 Z" />
      <path class="kid-hill kid-hill--hi" d="M 20 140 Q 110 70 200 140 Z" opacity="0.55" />
      <line
        class="kid-flag__pole"
        x1="150"
        y1="40"
        x2="150"
        y2="86"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path class="kid-flag__cloth" d="M 150 42 L 178 50 L 150 58 Z" />
      <circle class="kid-flag__top" cx="150" cy="40" r="3.5" />
    </svg>
  );
}

/** Small daisy flower used in clusters along the bottom edge. */
export function Flower(props: { class?: string; tone?: "pink" | "blue" | "yellow" }): JSX.Element {
  const tone = props.tone ?? "pink";
  return (
    <svg
      class={`kid-svg kid-flower kid-flower--${tone} ${props.class ?? ""}`}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <g class="kid-flower__petals">
        <circle cx="20" cy="9" r="6" />
        <circle cx="20" cy="31" r="6" />
        <circle cx="9" cy="20" r="6" />
        <circle cx="31" cy="20" r="6" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="28" cy="12" r="5" />
        <circle cx="12" cy="28" r="5" />
        <circle cx="28" cy="28" r="5" />
      </g>
      <circle class="kid-flower__center" cx="20" cy="20" r="6" />
    </svg>
  );
}

/** Decorative scenery wrapper. Renders all the pieces positioned absolutely. */
export function KidsScenery(): JSX.Element {
  return (
    <div class="kid-scenery" aria-hidden="true">
      <Cloud class="kid-scenery__cloud kid-scenery__cloud--a" />
      <Cloud class="kid-scenery__cloud kid-scenery__cloud--b" flip />
      <Tree class="kid-scenery__tree" />
      <HillFlag class="kid-scenery__hill" />
      <Flower class="kid-scenery__flower kid-scenery__flower--a" tone="pink" />
      <Flower class="kid-scenery__flower kid-scenery__flower--b" tone="yellow" />
      <Flower class="kid-scenery__flower kid-scenery__flower--c" tone="blue" />
      <StarMascot class="kid-scenery__star" />
    </div>
  );
}
