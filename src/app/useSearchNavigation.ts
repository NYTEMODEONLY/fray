import { useEffect, useMemo, useState } from "react";
import type { Message } from "../types";
import { buildSearchResultIds, type RoomSearchFilter } from "../services/messagePresentationService";

interface SearchNavigationOptions {
  messages: Message[];
  searchQuery: string;
  searchFilter: RoomSearchFilter;
  meId: string;
  meName: string;
  currentRoomId: string;
}

export const useSearchNavigation = ({
  messages,
  searchQuery,
  searchFilter,
  meId,
  meName,
  currentRoomId
}: SearchNavigationOptions) => {
  const [activeSearchResultIndex, setActiveSearchResultIndex] = useState(0);
  const [focusMessageId, setFocusMessageId] = useState<string | null>(null);

  const searchResultIds = useMemo(
    () =>
      buildSearchResultIds(messages, {
        query: searchQuery,
        filter: searchFilter,
        meId,
        meName
      }),
    [messages, searchQuery, searchFilter, meId, meName]
  );

  const activeSearchResultId =
    searchResultIds.length > 0
      ? searchResultIds[
          ((activeSearchResultIndex % searchResultIds.length) + searchResultIds.length) %
            searchResultIds.length
        ]
      : null;

  useEffect(() => {
    setActiveSearchResultIndex(0);
  }, [searchQuery, searchFilter, currentRoomId]);

  useEffect(() => {
    if (!searchResultIds.length) return;
    if (activeSearchResultIndex < searchResultIds.length) return;
    setActiveSearchResultIndex(0);
  }, [searchResultIds, activeSearchResultIndex]);

  useEffect(() => {
    if (!activeSearchResultId) return;
    setFocusMessageId(activeSearchResultId);
  }, [activeSearchResultId]);

  const navigateSearch = (direction: "next" | "prev") => {
    if (!searchResultIds.length) return;
    setActiveSearchResultIndex((currentIndex) => {
      const delta = direction === "next" ? 1 : -1;
      const nextIndex = (currentIndex + delta + searchResultIds.length) % searchResultIds.length;
      setFocusMessageId(searchResultIds[nextIndex] ?? null);
      return nextIndex;
    });
  };

  return {
    searchResultIds,
    activeSearchResultIndex,
    activeSearchResultId,
    focusMessageId,
    setFocusMessageId,
    navigateSearch
  };
};
