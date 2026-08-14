"use client";

import { useEffect, useRef, useState } from "react";

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
import { Separator } from "@/components/ui/separator";
import { cleanDisplayName } from "@/lib/app/display-name";
import type { AudioSettings } from "@/lib/audio-settings";

export function PlayerSettingsDialog({
  audioSettings,
  displayName,
  isPending = false,
  onAudioSettingsChange,
  onDisplayNameChange,
  onOpenChange,
  open,
}: {
  audioSettings: AudioSettings;
  displayName: string;
  isPending?: boolean;
  onAudioSettingsChange?(settings: AudioSettings): void;
  onDisplayNameChange?(value: string): void;
  onOpenChange(open: boolean): void;
  open: boolean;
}) {
  const [displayNameDraft, setDisplayNameDraft] = useState(displayName);
  const [audioSettingsDraft, setAudioSettingsDraft] = useState(audioSettings);
  const [audioSettingsAtOpen, setAudioSettingsAtOpen] = useState(audioSettings);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setDisplayNameDraft(displayName);
      setAudioSettingsDraft(audioSettings);
      setAudioSettingsAtOpen(audioSettings);
    }
    wasOpenRef.current = open;
  }, [audioSettings, displayName, open]);

  const closeAndRevertAudio = () => {
    onAudioSettingsChange?.(audioSettingsAtOpen);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isPending) {
          closeAndRevertAudio();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <form
          id="player-settings-form"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onDisplayNameChange?.(cleanDisplayName(displayNameDraft));
            onOpenChange(false);
          }}
        >
          <Field>
            <FieldLabel htmlFor="display-name-input">Display name</FieldLabel>
            <Input
              id="display-name-input"
              autoComplete="off"
              autoFocus
              maxLength={24}
              placeholder="Your name"
              value={displayNameDraft}
              onChange={(event) => setDisplayNameDraft(event.target.value)}
            />
          </Field>
          <Separator />
          <AudioSettingsControls
            onChange={(settings) => {
              setAudioSettingsDraft(settings);
              onAudioSettingsChange?.(settings);
            }}
            settings={audioSettingsDraft}
          />
        </form>
        <DialogFooter>
          <Button disabled={isPending} onClick={closeAndRevertAudio} variant="ghost">
            Cancel
          </Button>
          <Button
            disabled={isPending || !displayNameDraft.trim()}
            form="player-settings-form"
            type="submit"
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
