export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-7 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-[76px] w-[76px] rounded-full bg-zinc-200 dark:bg-zinc-800" />
      </div>
      <div className="h-16 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-[68px] rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}
