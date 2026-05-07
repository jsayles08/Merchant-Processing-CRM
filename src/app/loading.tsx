export default function Loading() {
  return (
    <main className="min-h-screen bg-[linear-gradient(120deg,#dceeff_0%,#edf8e5_58%,#fff6df_100%)] p-6">
      <div className="w-full space-y-6">
        <div className="h-12 w-72 animate-pulse rounded-full bg-white/55" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-32 animate-pulse rounded-[28px] bg-white/45" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-[34px] bg-white/45" />
      </div>
    </main>
  );
}
