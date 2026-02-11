import { describe, expect, it } from "vitest";
import { Message } from "../../types";
import {
  buildSearchResultIds,
  buildThreadSummaries,
  messageContainsLink,
  messageMentionsUser
} from "../messagePresentationService";

const messages: Message[] = [
  {
    id: "m1",
    roomId: "r1",
    authorId: "@me:example.com",
    body: "ship docs and changelog",
    timestamp: 1_700_000_000_000,
    reactions: []
  },
  {
    id: "m2",
    roomId: "r1",
    authorId: "@ava:example.com",
    body: "@me check https://matrix.org for the latest API changes",
    timestamp: 1_700_000_050_000,
    reactions: []
  },
  {
    id: "m3",
    roomId: "r1",
    authorId: "@ava:example.com",
    body: "thread reply",
    timestamp: 1_700_000_080_000,
    reactions: [],
    threadRootId: "m1"
  }
];

describe("Phase 4 message presentation service", () => {
  it("matches search results by text and filter", () => {
    expect(
      buildSearchResultIds(messages, {
        query: "ship",
        filter: "all",
        meId: "@me:example.com",
        meName: "me"
      })
    ).toEqual(["m1"]);

    expect(
      buildSearchResultIds(messages, {
        query: "",
        filter: "all",
        meId: "@me:example.com",
        meName: "me"
      })
    ).toEqual([]);

    expect(
      buildSearchResultIds(messages, {
        query: "",
        filter: "mentions",
        meId: "@me:example.com",
        meName: "me"
      })
    ).toEqual(["m2"]);

    expect(
      buildSearchResultIds(messages, {
        query: "",
        filter: "has_links",
        meId: "@me:example.com",
        meName: "me"
      })
    ).toEqual(["m2"]);

    expect(
      buildSearchResultIds(messages, {
        query: "",
        filter: "from_me",
        meId: "@me:example.com",
        meName: "me"
      })
    ).toEqual(["m1"]);
  });

  it("builds unread thread summaries from room and thread read markers", () => {
    const summaries = buildThreadSummaries(messages, 1_700_000_020_000, {
      m1: 1_700_000_060_000
    });
    expect(summaries.m1.totalReplies).toBe(1);
    expect(summaries.m1.unreadReplies).toBe(1);
  });

  it("detects link and mention content", () => {
    expect(messageContainsLink(messages[1])).toBe(true);
    expect(messageMentionsUser(messages[1], "@me:example.com", "me")).toBe(true);
  });
});
