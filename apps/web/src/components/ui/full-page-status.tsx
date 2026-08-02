import Image from "next/image";

import { AppScenery } from "@/components/ui/app-scenery";
import { Brand } from "@/components/ui/brand";

import styles from "./full-page-status.module.css";

interface FullPageStatusProps {
  label: string;
}

export function FullPageStatus({ label }: FullPageStatusProps) {
  return (
    <main className={styles.page} id="main-content">
      <AppScenery />

      <div className={styles.content}>
        <Brand className={styles.brand} />

        <div className={styles.scene} aria-hidden="true">
          <span className={styles.halo} />

          <div className={styles.island}>
            <span className={`${styles.hex} ${styles.top}`} />
            <span className={`${styles.hex} ${styles.upperLeft}`} />
            <span className={`${styles.hex} ${styles.upperRight}`} />
            <span className={`${styles.hex} ${styles.center}`} />
            <span className={`${styles.hex} ${styles.lowerLeft}`} />
            <span className={`${styles.hex} ${styles.lowerRight}`} />
            <span className={`${styles.hex} ${styles.bottom}`} />
            <Image
              alt=""
              className={styles.settlement}
              height={64}
              priority
              src="/game-assets/pieces/settlement-piece.png"
              width={64}
            />
          </div>

          <div className={styles.dice}>
            <span className={`${styles.die} ${styles.dieA}`}>5</span>
            <span className={`${styles.die} ${styles.dieB}`}>6</span>
          </div>
        </div>

        <div className={styles.copy} aria-atomic="true" aria-live="polite" role="status">
          <p className={styles.label}>{label}</p>

          <span className={styles.progress}>
            <span className={styles.progressFill} />
          </span>

          <p className={styles.hint}>Charting coasts and gathering your crew…</p>
        </div>
      </div>
    </main>
  );
}
