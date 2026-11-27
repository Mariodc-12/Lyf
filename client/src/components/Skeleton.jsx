export default function Skeleton() {
  return (
    <div className="animate-pulse px-5 pt-8" aria-busy="true" aria-label="Loading">
      <div className="h-4 w-28 rounded bg-ink/10" />
      <div className="mt-3 h-8 w-48 rounded bg-ink/10" />
      <div className="mt-6 h-60 rounded-2xl bg-ink/10" />
      <div className="mt-4 h-20 rounded-2xl bg-ink/[0.07]" />
    </div>
  );
}
