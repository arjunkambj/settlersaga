"use client";

import type { BotDifficulty, PlayerGameView } from "@settersaga/game";
import arrowDownIcon from "@iconify-icons/solar/arrow-down-bold";
import { Icon } from "@iconify/react/offline";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { eventActionLabel, groupRoomEvents, noticeText } from "@/lib/game/event-log-model";
import { getPlayerPortraitSrc } from "@/lib/game/hud-portraits";
import type { RoomEventView } from "@/lib/game/types";
import { getPlayerColor } from "@/lib/game/view";
import { cn } from "@/lib/utils";

import { EventKindBadge } from "./hud-event-badge";
import { PlayerAvatar } from "./player-avatar";
import { useTimeOfDayFormatter } from "./use-time-of-day-formatter";

export function EventLog({
  botDifficulty,
  events,
  players,
  viewerPlayerId,
  viewerProfileImageUrl,
}: {
  botDifficulty: BotDifficulty;
  events: readonly RoomEventView[];
  players: PlayerGameView["players"];
  viewerPlayerId: string;
  viewerProfileImageUrl: string | null;
}) {
  const [pinnedToLatest, setPinnedToLatest] = useState(true);
  const lastEventId = events.at(-1)?.id;
  const [seenEventId, setSeenEventId] = useState(lastEventId);
  // Moves already in the log when it opened sit still; later ones pop in.
  const [openedAt] = useState(() =>
    events.reduce((latest, event) => Math.max(latest, event.createdAt), 0),
  );
  const hasUnseen = !pinnedToLatest && lastEventId !== seenEventId;
  const listRef = useRef<HTMLOListElement>(null);
  const entries = useMemo(() => groupRoomEvents(events), [events]);
  const playersById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );

  const timeFormatter = useTimeOfDayFormatter();

  useEffect(() => {
    const list = listRef.current;
    if (!list || !pinnedToLatest) {
      return;
    }

    const showLatest = () => {
      list.scrollTop = getLatestScrollTop(list);
    };
    showLatest();
    // A hidden tab has no height to scroll; catch up on the moves it missed once it is shown.
    const observer = new ResizeObserver(showLatest);
    observer.observe(list);
    return () => observer.disconnect();
  }, [lastEventId, pinnedToLatest]);

  return (
    <div className="game-event-log">
      <ol
        className="game-event-log-list game-scroll-fade"
        onScroll={(event) => {
          const list = event.currentTarget;
          const atLatest = list.scrollTop >= getLatestScrollTop(list) - 40;
          if (!atLatest && pinnedToLatest) {
            setSeenEventId(lastEventId);
          }
          setPinnedToLatest(atLatest);
        }}
        ref={listRef}
      >
        {entries.length > 0 ? (
          entries.map((entry, index) => {
            const first = entry.type === "notice" ? entry.event : entry.events[0];
            const isFresh = first !== undefined && first.createdAt > openedAt;
            if (entry.type === "notice") {
              return (
                <li
                  className={cn("game-log-notice", isFresh && "motion-safe:animate-game-pop")}
                  key={entry.key}
                >
                  <EventKindBadge kind={entry.event.kind} />
                  <p className="m-0 min-w-0">{noticeText(entry.event.text)}</p>
                </li>
              );
            }

            const actor = playersById.get(entry.actorPlayerId);
            const latest = entry.events.at(-1);
            const isNewest = index === entries.length - 1;
            return (
              <li
                className={cn(
                  "game-log-entry",
                  actor && `player-${getPlayerColor(actor)}`,
                  isFresh && "motion-safe:animate-game-pop",
                )}
                data-latest={isNewest || undefined}
                key={entry.key}
              >
                <PlayerAvatar
                  className="game-log-avatar"
                  imageSize={32}
                  isBot={actor?.isBot ?? false}
                  name={actor?.displayName ?? "Crew"}
                  src={
                    actor
                      ? getPlayerPortraitSrc(actor, { botDifficulty, viewerProfileImageUrl })
                      : undefined
                  }
                />
                <div className="game-log-bubble">
                  <p className="game-log-head">
                    <strong className="game-log-name">{actor?.displayName ?? "Crew"}</strong>
                    {/* One tag at most, so the name and the time keep one line: "Latest" on
                        the newest bubble, whoever made it, and "You" on the viewer's others. */}
                    {isNewest ? (
                      <span className="game-log-latest">Latest</span>
                    ) : actor?.id === viewerPlayerId ? (
                      <span className="game-you-tag">You</span>
                    ) : null}
                    {latest ? (
                      <time
                        className="game-log-time"
                        dateTime={new Date(latest.createdAt).toISOString()}
                      >
                        {timeFormatter.format(latest.createdAt)}
                      </time>
                    ) : null}
                  </p>
                  <ol className="game-log-lines">
                    {entry.events.map((item) => (
                      <li
                        className={cn(
                          "game-log-line",
                          item.createdAt > openedAt && "motion-safe:animate-game-rise",
                        )}
                        key={item.id}
                      >
                        <EventKindBadge kind={item.kind} />
                        <p className="m-0 min-w-0">
                          {eventActionLabel(item.text, actor?.displayName)}
                        </p>
                      </li>
                    ))}
                  </ol>
                </div>
              </li>
            );
          })
        ) : (
          <li className="game-log-empty">
            <p className="m-0">No moves yet. They show up here as the crew plays.</p>
          </li>
        )}
      </ol>
      {hasUnseen ? (
        <Button
          className="game-log-jump motion-safe:animate-game-pop"
          onClick={() => setPinnedToLatest(true)}
          size="game-sm"
          variant="game"
        >
          <Icon aria-hidden="true" icon={arrowDownIcon} />
          New moves
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Where the list rests on its newest move: scrolled to the end, unless the newest bubble is
 * taller than the list, in which case its name row stays in view at the top (just below the
 * scroll fade) and its later lines run under the bottom edge.
 */
function getLatestScrollTop(list: HTMLElement): number {
  const end = list.scrollHeight - list.clientHeight;
  const newest = list.lastElementChild;
  if (!(newest instanceof HTMLElement)) {
    return end;
  }
  const fade = Number.parseFloat(getComputedStyle(list).getPropertyValue("--scroll-fade-size"));
  // The list is the bubbles' offset parent (position: relative), so this ignores the scroll.
  const newestTop = newest.offsetTop - (Number.isFinite(fade) ? fade : 0);
  return Math.max(0, Math.min(end, newestTop));
}
