"use client";

import { CHAT_MESSAGE_MAX_LENGTH } from "@settersaga/backend/convex/model/constants";
import type { PlayerColor } from "@settersaga/game";
import chatIcon from "@iconify-icons/solar/chat-round-dots-bold";
import sendIcon from "@iconify-icons/solar/plain-2-bold";
import { Icon } from "@iconify/react/offline";
import { useId, useState, type FormEvent } from "react";

import { useTimeOfDayFormatter } from "@/components/game/use-time-of-day-formatter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { toActionableError } from "@/lib/app/action-errors";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  readonly body: string;
  readonly displayName: string;
  readonly id: string;
  readonly isMine: boolean;
  readonly playerColor?: PlayerColor;
  readonly sentAt: number;
}

/** A room's shared chat: the latest messages, and a send that rejects when the server refuses. */
export interface RoomChat {
  readonly messages: readonly ChatMessage[];
  onSend(body: string): Promise<void>;
}

export interface ChatPanelProps extends RoomChat {
  readonly className?: string;
  readonly disabled: boolean;
}

export function ChatPanel({ className, disabled, messages, onSend }: ChatPanelProps) {
  const inputId = useId();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const body = draft.trim();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body || disabled || sending) return;
    const sent = draft;
    setSending(true);
    setError("");
    try {
      await onSend(body);
      // Only what was sent leaves the box; anything typed after it while it was on its way stays.
      setDraft((current) =>
        current.startsWith(sent) ? current.slice(sent.length).trimStart() : current,
      );
    } catch (cause) {
      setError(toActionableError(cause));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col gap-3", className)}>
      {/* column-reverse keeps the list pinned to the newest message as messages arrive. */}
      <div
        aria-label="Chat messages"
        className="chat-log flex min-h-0 flex-1 flex-col-reverse overflow-y-auto rounded-2xl border-2 border-well-edge bg-well p-3 inset-shadow-well"
        role="log"
      >
        <ol className="flex flex-col gap-3">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
        </ol>
        {messages.length === 0 ? (
          <div className="m-auto flex flex-col items-center gap-1 p-3 text-center">
            <Icon className="mb-1 size-9 text-accent" icon={chatIcon} />
            <p className="font-display text-lg tracking-wide">No messages yet</p>
            <p className="text-sm text-muted-foreground">Say hi to your crew</p>
          </div>
        ) : null}
      </div>

      <LiveMessage message={error} />

      <form className="flex items-center gap-2" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor={inputId}>
          Message
        </label>
        <Input
          autoComplete="off"
          className="h-11 flex-1 px-4"
          disabled={disabled}
          enterKeyHint="send"
          id={inputId}
          maxLength={CHAT_MESSAGE_MAX_LENGTH}
          onChange={(event) => {
            setDraft(event.target.value);
            setError("");
          }}
          placeholder="Send a message…"
          value={draft}
        />
        <Button
          aria-label={sending ? "Sending message" : "Send message"}
          disabled={disabled || sending || !body}
          size="game-md"
          type="submit"
          variant="game-icon"
        >
          {sending ? <Spinner className="size-5" /> : <Icon icon={sendIcon} />}
        </Button>
      </form>
    </div>
  );
}

function ChatBubble({ message }: { readonly message: ChatMessage }) {
  const sentAt = new Date(message.sentAt);
  const timeFormatter = useTimeOfDayFormatter();

  return (
    <li
      className={cn(
        "flex max-w-[85%] flex-col gap-1",
        message.isMine ? "items-end self-end" : "items-start self-start",
        message.playerColor && `player-${message.playerColor}`,
      )}
    >
      <span className="flex items-baseline gap-2 px-1 text-xs">
        <span
          className={cn(
            "font-display text-sm tracking-wide",
            message.playerColor ? "text-(--player-color)" : "text-foreground",
          )}
        >
          {message.displayName}
        </span>
        <time className="font-semibold text-muted-foreground" dateTime={sentAt.toISOString()}>
          {timeFormatter.format(sentAt)}
        </time>
      </span>
      <p
        className={cn(
          "rounded-2xl px-3 py-2 text-sm font-medium break-words shadow-knob",
          message.isMine
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md bg-panel-top text-foreground",
        )}
      >
        {message.body}
      </p>
    </li>
  );
}
