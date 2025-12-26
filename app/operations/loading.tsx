import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function OperationsLoading() {
  return (
    <main className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="h-8 w-64 bg-muted rounded animate-pulse mb-2" />
          <div className="h-4 w-96 bg-muted rounded animate-pulse" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <div className="h-5 w-40 bg-muted rounded animate-pulse" />
                  <div className="h-8 w-12 bg-muted rounded animate-pulse" />
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-20 bg-muted rounded animate-pulse" />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </main>
  )
}
