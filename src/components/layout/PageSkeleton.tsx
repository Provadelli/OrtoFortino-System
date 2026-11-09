export function PageSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-6">
      <div className="h-16 w-64 animate-pulse rounded-card bg-line" />
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[130px] animate-pulse rounded-card bg-white" />
        ))}
      </div>
    </div>
  )
}
