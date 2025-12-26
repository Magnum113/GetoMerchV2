export default function FulfillmentLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="mx-auto max-w-7xl p-6 space-y-8">
        <div className="h-12 w-64 bg-slate-200 rounded animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-lg shadow-sm animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-lg shadow-sm animate-pulse" />
      </div>
    </div>
  )
}
