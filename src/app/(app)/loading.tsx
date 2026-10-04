export default function Loading() {
  return (
    <div className="animate-pulse space-y-10" aria-busy="true" aria-label="…">
      <div className="space-y-3">
        <div className="h-3 w-32 bg-surface" />
        <div className="h-9 w-56 bg-surface" />
      </div>
      <div className="h-px w-full bg-line" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-6 w-6 rounded-full bg-surface" />
          <div className="h-4 flex-1 bg-surface" />
          <div className="h-10 w-10 rounded-full bg-surface" />
        </div>
      ))}
    </div>
  );
}
