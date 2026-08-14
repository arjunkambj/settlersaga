import arrowLeftIcon from "@iconify-icons/solar/arrow-left-bold";
import { Icon } from "@iconify/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { getDoc, listDocs } from "@/lib/docs";

interface DocPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const docs = await listDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = await getDoc(slug);

  return {
    title: doc ? `${doc.title} · SetterSaga` : "Docs · SetterSaga",
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const doc = await getDoc(slug);

  if (!doc) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-background text-foreground overflow-y-auto" id="main-content">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        <Link
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          href="/docs"
        >
          <Icon aria-hidden="true" icon={arrowLeftIcon} width={16} />
          Back to docs
        </Link>

        <article className="prose prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </article>
      </div>
    </main>
  );
}
