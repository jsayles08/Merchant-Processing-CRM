import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-950">
            <SearchX className="h-6 w-6" />
          </div>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>The record or page you requested is not available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/"
            className="inline-flex h-10 items-center justify-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white shadow-sm shadow-emerald-950/10 transition hover:bg-emerald-700"
          >
            Return to Dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
