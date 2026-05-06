export default function Loading() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <div className="h-12 w-72 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
      </div>
    </main>
  );
}
