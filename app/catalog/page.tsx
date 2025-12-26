import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Package, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SyncProductsButton } from "@/components/catalog/sync-products-button"
import { EditProductDialog } from "@/components/catalog/edit-product-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export default async function CatalogPage() {
  const supabase = await createClient()

  const { data: products } = await supabase
    .from("products")
    .select(
      `
      *,
      inventory(quantity_in_stock, quantity_reserved, min_stock_level)
    `,
    )
    .order("created_at", { ascending: false })

  const { data: lastSync } = await supabase
    .from("sync_log")
    .select("*")
    .eq("sync_type", "products")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle() // заменил .single() на .maybeSingle() чтобы не падать если записей нет

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case "success":
        return "Успешно"
      case "error":
        return "Ошибка"
      case "in_progress":
        return "Выполняется"
      default:
        return status
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Каталог Ozon</h1>
          <p className="text-gray-600">Управление товарами на маркетплейсе Ozon</p>
        </div>
        <div className="flex items-center gap-2">
          <SyncProductsButton />
        </div>
      </div>

      {(!process.env.OZON_CLIENT_ID || !process.env.OZON_API_KEY) && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Не настроены ключи Ozon API. Добавьте переменные окружения OZON_CLIENT_ID и OZON_API_KEY в настройках
            проекта.
          </AlertDescription>
        </Alert>
      )}

      {lastSync && (
        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Последняя синхронизация</CardTitle>
                <CardDescription className="text-sm">
                  {lastSync.completed_at ? formatDate(lastSync.completed_at) : "Выполняется..."}
                </CardDescription>
              </div>
              <Badge
                variant={
                  lastSync.status === "success" ? "default" : lastSync.status === "error" ? "destructive" : "secondary"
                }
                className="font-medium"
              >
                {getStatusText(lastSync.status)}
              </Badge>
            </div>
          </CardHeader>
          {lastSync.status === "success" && lastSync.items_synced !== null && (
            <CardContent className="pt-4">
              <p className="text-sm text-gray-600 font-medium">Синхронизировано товаров: <span className="font-bold text-gray-900">{lastSync.items_synced}</span></p>
            </CardContent>
          )}
          {lastSync.status === "error" && lastSync.error_message && (
            <CardContent className="pt-4">
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-700 font-medium mb-1">Ошибка синхронизации:</p>
                <p className="text-sm text-red-600">{lastSync.error_message}</p>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-0 shadow-soft">
        <CardHeader className="border-b border-gray-100 pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold">Товары</CardTitle>
              <CardDescription className="text-sm">Всего товаров: {products?.length || 0}</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input 
                type="search" 
                placeholder="Поиск товаров..." 
                className="pl-10 h-10 bg-gray-50/80 border-gray-200 rounded-lg focus:bg-white focus:border-primary/50" 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                  <TableHead className="font-semibold text-gray-700">Товар</TableHead>
                  <TableHead className="font-semibold text-gray-700">Артикул</TableHead>
                  <TableHead className="font-semibold text-gray-700">Категория</TableHead>
                  <TableHead className="font-semibold text-gray-700">Цена</TableHead>
                  <TableHead className="font-semibold text-gray-700">Остаток</TableHead>
                  <TableHead className="font-semibold text-gray-700">Статус</TableHead>
                  <TableHead className="text-right font-semibold text-gray-700">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products && products.length > 0 ? (
                  products.map((product) => {
                    const inventory = product.inventory?.[0]
                    const stockLevel = inventory?.quantity_in_stock || 0
                    const minLevel = inventory?.min_stock_level || 0
                    const isLowStock = stockLevel <= minLevel

                    return (
                      <TableRow 
                        key={product.id}
                        className="hover:bg-gray-50/50 transition-colors border-b border-gray-100"
                      >
                        <TableCell className="py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden border border-gray-200">
                              {product.image_url ? (
                                <img
                                  src={product.image_url || "/placeholder.svg"}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-6 w-6 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {product.name && product.name !== product.sku ? product.name : product.sku}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">ID: {product.ozon_product_id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="font-mono text-sm text-gray-600">{product.sku}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <span className="text-sm text-gray-600">{product.category || "—"}</span>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1">
                            {product.price ? (
                              <>
                                <span className="font-bold text-gray-900">
                                  {Math.round(product.price).toLocaleString('ru-RU')} {product.currency || "₽"}
                                </span>
                                {product.price_old && product.price_old > product.price && (
                                  <span className="text-xs text-gray-400 line-through">
                                    {Math.round(product.price_old).toLocaleString('ru-RU')} {product.currency || "₽"}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-gray-900"}`}>
                              {stockLevel}
                            </span>
                            {isLowStock && (
                              <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-xs font-medium">
                                Мало
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant={product.is_active ? "default" : "secondary"}
                            className={product.is_active ? "bg-green-100 text-green-700 border-green-200 font-medium" : "font-medium"}
                          >
                            {product.is_active ? "Активен" : "Неактивен"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <EditProductDialog
                            product={{
                              id: product.id,
                              name: product.name,
                              sku: product.sku,
                              price: product.price,
                              category: product.category,
                              is_active: product.is_active,
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Package className="h-12 w-12 text-gray-300" />
                        <p className="text-base font-medium text-gray-500">Каталог пуст</p>
                        <p className="text-sm text-gray-400">Нажмите &quot;Синхронизировать с Ozon&quot; для импорта товаров</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
