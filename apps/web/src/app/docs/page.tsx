import arrowLeftIcon from "@iconify-icons/solar/arrow-left-bold";
import documentIcon from "@iconify-icons/solar/document-text-bold";
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";

import { listDocs } from "@/lib/docs";

export const metadata: Metadata = {
  description: "Project documentation for SetterSaga.",
  title: "Docs · SetterSaga",
};

export default async function DocsPage() {
  const docs = await listDocs();

  return (
    <main className="min-h-screen bg-background text-foreground overflow-y-auto" id="main-content">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <header className="border-b border-border pb-6 space-y-6">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            href="/"
          >
            <Icon aria-hidden="true" icon={arrowLeftIcon} width={16} />
            Back to game
          </Link>

          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-accent">
              Documentation
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">Docs</h1>
          </div>
        </header>

        {docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documentation found yet.</p>
        ) : (
          <ul className="space-y-3">
            {docs.map((doc) => (
              <li key={doc.slug}>
                <Link
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground transition-colors hover:border-primary"
                  href={`/docs/${doc.slug}`}
                >
                  <Icon
                    aria-hidden="true"
                    className="shrink-0 text-brand-accent"
                    icon={documentIcon}
                    width={22}
                  />
                  <span className="font-semibold">{doc.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
