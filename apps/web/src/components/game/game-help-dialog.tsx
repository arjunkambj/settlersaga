"use client";

import arrowLeftIcon from "@iconify-icons/solar/alt-arrow-left-bold";
import arrowRightIcon from "@iconify-icons/solar/alt-arrow-right-bold";
import checkIcon from "@iconify-icons/solar/check-circle-bold";
import { Icon } from "@iconify/react/offline";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getGuidePages, type GuideSettings } from "@/lib/game/guide-pages";

import { GameDialog } from "./game-dialog";

export const GAME_HELP_DIALOG_ID = "game-help-dialog";

export function GameHelpDialog({
  onClose,
  settings,
}: {
  onClose(): void;
  settings: GuideSettings;
}) {
  const [pageIndex, setPageIndex] = useState(0);
  const tabsRef = useRef<HTMLDivElement>(null);
  const guidePages = getGuidePages(settings);
  const page = guidePages[pageIndex];
  const lastPageIndex = guidePages.length - 1;
  const isFirstPage = pageIndex === 0;
  const isLastPage = pageIndex === lastPageIndex;

  const showPage = (index: number) => setPageIndex(Math.min(lastPageIndex, Math.max(0, index)));

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        setPageIndex((current) =>
          Math.min(lastPageIndex, Math.max(0, current + (event.key === "ArrowRight" ? 1 : -1))),
        );
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lastPageIndex]);

  // The selected tab stays in view, and keeps focus when the arrow keys turned the page from it.
  useEffect(() => {
    const tabs = tabsRef.current;
    const selectedTab = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    selectedTab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (tabs?.contains(document.activeElement)) {
      selectedTab?.focus();
    }
  }, [pageIndex]);

  return (
    <GameDialog
      dialogClassName="sm:max-w-[min(48rem,calc(100%-2rem))]"
      footer={
        <>
          <Button
            aria-label="Previous topic"
            className="justify-self-start"
            disabled={isFirstPage}
            onClick={() => showPage(pageIndex - 1)}
            size="game-lg"
            variant="game-icon"
          >
            <Icon aria-hidden="true" icon={arrowLeftIcon} />
          </Button>
          <p className="m-0 flex items-center gap-1.5" aria-live="polite">
            {guidePages.map((guidePage, index) => (
              <span
                aria-hidden="true"
                className="game-guide-dot max-sm:hidden"
                data-active={index === pageIndex || undefined}
                key={guidePage.topic}
              />
            ))}
            <span aria-hidden="true" className="game-guide-count">
              {pageIndex + 1}/{guidePages.length}
            </span>
            <span className="sr-only">
              {page.topic}, {pageIndex + 1} of {guidePages.length}
            </span>
          </p>
          {isLastPage ? (
            <Button
              className="justify-self-end"
              onClick={onClose}
              size="game-lg"
              variant="game-gold"
            >
              <Icon aria-hidden="true" icon={checkIcon} />
              Got it
            </Button>
          ) : (
            <Button
              aria-label="Next topic"
              className="justify-self-end"
              onClick={() => showPage(pageIndex + 1)}
              size="game-lg"
              variant="game-icon"
            >
              <Icon aria-hidden="true" icon={arrowRightIcon} />
            </Button>
          )}
        </>
      }
      footerClassName="grid w-full grid-cols-[1fr_auto_1fr] items-center justify-normal gap-3"
      id={GAME_HELP_DIALOG_ID}
      kicker={`The whole game in ${guidePages.length} quick pages`}
      onClose={onClose}
      title="How to play"
      toolbar={
        <div aria-label="Guide topics" className="game-guide-tabs" ref={tabsRef} role="tablist">
          {guidePages.map((guidePage, index) => {
            const selected = index === pageIndex;
            return (
              <button
                aria-controls="game-guide-page"
                aria-selected={selected}
                className="game-guide-tab"
                id={`game-guide-tab-${index}`}
                key={guidePage.topic}
                onClick={() => showPage(index)}
                role="tab"
                tabIndex={selected ? 0 : -1}
                type="button"
              >
                {guidePage.topic}
              </button>
            );
          })}
        </div>
      }
    >
      <article
        aria-labelledby={`game-guide-tab-${pageIndex}`}
        className="grid content-start gap-4 sm:min-h-76 sm:gap-5"
        id="game-guide-page"
        key={page.topic}
        role="tabpanel"
      >
        <div className="grid items-center gap-3 sm:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] sm:gap-6">
          <div className="game-guide-art game-art-stage flex h-28 items-center justify-center gap-3 rounded-2xl p-3 sm:h-40 sm:p-2">
            {page.art.map((asset) => (
              <Image
                alt={asset.alt}
                className="h-full min-w-0 flex-1 object-contain motion-safe:animate-game-pop"
                draggable={false}
                height={asset.height}
                key={asset.path}
                priority={pageIndex === 0}
                sizes={page.art.length > 1 ? "8rem" : "16rem"}
                src={asset.path}
                width={asset.width}
              />
            ))}
          </div>
          <div className="grid gap-2 text-center sm:text-left">
            <h3 className="game-title m-0 text-xl text-balance sm:text-2xl">{page.title}</h3>
            <p className="m-0 text-base leading-relaxed font-medium text-muted-foreground text-pretty">
              {page.lead}
            </p>
          </div>
        </div>

        <ol className="grid gap-3 sm:grid-cols-3">
          {page.tips.map((tip, index) => (
            <li className="game-guide-tip" key={tip.title}>
              <span aria-hidden="true" className="game-guide-tip-number">
                {index + 1}
              </span>
              <p className="game-guide-tip-title">{tip.title}</p>
              <p className="game-guide-tip-copy">{tip.copy}</p>
            </li>
          ))}
        </ol>
      </article>
    </GameDialog>
  );
}
