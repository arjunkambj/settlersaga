import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main
      className="flex min-h-dvh items-center justify-center bg-background p-6"
      id="main-content"
    >
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center">
          <CardTitle>Island not found</CardTitle>
          <CardDescription>The page you are looking for does not exist.</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Link href="/">
            <Button>Return home</Button>
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
