import { marked } from "marked";
import DOMPurify from "dompurify";

const renderer = new marked.Renderer();
renderer.link = (href, _title, text) =>
  `<a href="${href ?? "#"}" target="_blank" rel="noreferrer">${text}</a>`;

marked.setOptions({
  breaks: true,
  gfm: true
});

marked.use({ renderer });

const spoilerize = (value: string) =>
  value.replace(/\|\|(.+?)\|\|/g, "<span class=\"spoiler\">$1</span>");

const mentionize = (value: string) =>
  value.replace(/(^|\s)@([a-zA-Z0-9_-]+)/g, "$1<span class=\"mention\">@$2</span>");

export const renderMarkdown = (value: string) => {
  const withSpoilers = spoilerize(value);
  const withMentions = mentionize(withSpoilers);
  const html = marked.parse(withMentions) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "a",
      "p",
      "strong",
      "em",
      "code",
      "pre",
      "blockquote",
      "ul",
      "ol",
      "li",
      "span",
      "br"
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"]
  });
};
