import Link from "next/link";
import { SearchX } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="crm-shell-bg flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-xl">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0B0F15] text-white">
            <SearchX className="h-6 w-6" />
          </div>
          <CardTitle>Page Not Found</CardTitle>
          <CardDescription>The record or page you requested is not available.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#0B0F15] px-4 text-sm font-semibold text-white shadow-sm shadow-[#0B0F15]/10 transition hover:bg-[#25425E]"
          >
            Return to Dashboard
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
