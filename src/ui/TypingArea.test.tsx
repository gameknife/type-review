// @vitest-environment jsdom
import { render } from "solid-js/web";
import { afterEach, describe, expect, it } from "vitest";
import type { TypingSnapshot } from "../engine/typing";
import { TypingArea } from "./TypingArea";

function snapshot(expected: string): TypingSnapshot {
  return {
    expected,
    statuses: new Array(expected.length).fill("untyped"),
    pos: 0,
    completed: false,
  };
}

describe("TypingArea", () => {
  let dispose: (() => void) | undefined;

  afterEach(() => {
    dispose?.();
    dispose = undefined;
    document.body.innerHTML = "";
  });

  it("renders display-only ruby cells like punctuation", () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    dispose = render(
      () => (
        <TypingArea
          typing={snapshot("ni hao")}
          showWhitespace
          display={[
            { start: 0, pinyin: "ni", display: "你" },
            { start: 2, pinyin: "", display: "，" },
            { start: 3, pinyin: "hao", display: "好" },
          ]}
        />
      ),
      host,
    );
    expect(host.querySelector(".ruby-group--display-only .ruby-group__display")?.textContent).toBe(
      "，",
    );
    expect(host.querySelector(".typing-area")?.textContent).toContain("，");
  });
});
