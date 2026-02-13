import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../markdown";

describe("markdown renderer parity", () => {
  it("supports underline, strike, spoiler, and mxid-style mentions", () => {
    const html = renderMarkdown("Hello __under__ ~~gone~~ ||secret|| @nyte @me:example.com");

    expect(html).toContain("<u>under</u>");
    expect(html).toContain("<del>gone</del>");
    expect(html).toContain("<span class=\"spoiler\">secret</span>");
    expect(html).toContain("<span class=\"mention\">@nyte</span>");
    expect(html).toContain("<span class=\"mention\">@me:example.com</span>");
  });

  it("does not convert email addresses into mentions", () => {
    const html = renderMarkdown("email test@example.com and ping @me");
    expect(html).not.toContain("test<span class=\"mention\">@example.com</span>");
    expect(html).toContain("<span class=\"mention\">@me</span>");
  });

  it("sanitizes dangerous html content", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1) /><script>alert(1)</script>");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("onerror=");
  });
});
