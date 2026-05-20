import type { JSX } from "solid-js";
import { Show } from "solid-js";
import { App } from "./App";
import { KidsApp } from "./KidsApp";
import { createTheme } from "./theme";

/**
 * Top-level switch between the grown-up `App` and the kid-mode
 * `KidsApp`. Owns the shared `ThemeController` so both trees see the
 * same theme signal — changing the theme from one tree (e.g. exiting
 * kids mode) reactively swaps the rendered tree.
 *
 * Kept intentionally tiny so the existing `App` doesn't need to know
 * the other tree exists.
 */
export function Root(): JSX.Element {
  const theme = createTheme();
  return (
    <Show when={theme.theme() === "kids"} fallback={<App themeController={theme} />}>
      <KidsApp themeController={theme} />
    </Show>
  );
}
