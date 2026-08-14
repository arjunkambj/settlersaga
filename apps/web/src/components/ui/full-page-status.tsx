import { BrandMark } from "@/components/app/brand-logo";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

interface FullPageStatusProps {
  label: string;
}

export function FullPageStatus({ label }: FullPageStatusProps) {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background p-6"
      id="main-content"
    >
      <Card className="w-full max-w-sm text-center">
        <CardContent className="flex flex-col items-center gap-4">
          <BrandMark className="size-16 drop-shadow-none" />
          <Spinner />
          <p className="text-sm font-medium" aria-live="polite" role="status">
            {label}
          </p>
          <p className="text-xs text-muted-foreground">
            Charting coasts and gathering your crew...
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
