"use client";

import { DISPLAY_NAME_MAX_LENGTH } from "@settersaga/backend/convex/model/constants";
import { useState } from "react";

import { AudioSettingsControls } from "@/components/audio/audio-settings-controls";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { LiveMessage } from "@/components/ui/live-message";
import { Spinner } from "@/components/ui/spinner";
import { toActionableError } from "@/lib/app/action-errors";
import type { AudioSettings } from "@/lib/audio-settings";

interface PlayerSettingsDialogProps {
  audioSettings: AudioSettings;
  displayName: string;
  isPending?: boolean;
  /** Applied live while the sliders move; Cancel restores the settings the dialog opened with. */
  onAudioSettingsChange?(settings: AudioSettings): void;
  /** Saves a new name; a rejection keeps the dialog open and explains why. */
  onDisplayNameChange?(value: string): Promise<void>;
  onOpenChange(open: boolean): void;
  open: boolean;
}

export function PlayerSettingsDialog({
  audioSettings,
  displayName,
  isPending = false,
  onAudioSettingsChange,
  onDisplayNameChange,
  onOpenChange,
  open,
}: PlayerSettingsDialogProps) {
  // Edits stay null until the player changes something, so every visit starts from the live name
  // and sound levels. They are cleared once the closing animation ends.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [audioBeforeEdit, setAudioBeforeEdit] = useState<AudioSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const name = nameDraft ?? displayName;
  const busy = isPending || saving;

  const cancel = () => {
    if (audioBeforeEdit) onAudioSettingsChange?.(audioBeforeEdit);
    onOpenChange(false);
  };

  const save = async () => {
    const trimmedName = name.trim();
    if (trimmedName !== displayName && onDisplayNameChange) {
      setError("");
      setSaving(true);
      try {
        await onDisplayNameChange(trimmedName);
      } catch (cause) {
        setError(toActionableError(cause));
        return;
      } finally {
        setSaving(false);
      }
    }
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !busy) cancel();
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setNameDraft(null);
        setAudioBeforeEdit(null);
        setError("");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <form
          id="player-settings-form"
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Field className="gap-2">
            <FieldLabel
              className="font-display text-base font-normal tracking-wide"
              htmlFor="display-name-input"
            >
              Your name
            </FieldLabel>
            <Input
              autoComplete="nickname"
              autoFocus
              className="h-11"
              id="display-name-input"
              maxLength={DISPLAY_NAME_MAX_LENGTH}
              onChange={(event) => {
                setError("");
                setNameDraft(event.target.value);
              }}
              placeholder="Pick a name"
              readOnly={saving}
              value={name}
            />
            <LiveMessage message={error} />
          </Field>
          <AudioSettingsControls
            onChange={(settings) => {
              setAudioBeforeEdit((current) => current ?? audioSettings);
              onAudioSettingsChange?.(settings);
            }}
            settings={audioSettings}
          />
        </form>
        <DialogFooter>
          <Button disabled={busy} onClick={cancel} size="game-md" variant="game-secondary">
            Cancel
          </Button>
          <Button
            disabled={busy || !name.trim()}
            form="player-settings-form"
            size="game-md"
            type="submit"
            variant="game-gold"
          >
            {saving ? <Spinner data-icon="inline-start" /> : null}
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
