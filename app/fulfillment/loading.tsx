export default function FulfillmentLoading() {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-7xl space-y-8 p-4 md:p-6 lg:p-8">
        <div className="h-12 w-64 bg-muted/60 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-card rounded-lg shadow-sm animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-card rounded-lg shadow-sm animate-pulse" />
      </div>
    </div>
  )
}
