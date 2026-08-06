import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        <CardHeader className="items-center">
          <CardTitle className="text-lg">SetterSaga</CardTitle>
          <CardDescription>Settler Saga</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
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
