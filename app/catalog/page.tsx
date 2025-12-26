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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Каталог Ozon</h1>
          <p className="text-muted-foreground mt-1">Управление товарами на маркетплейсе Ozon</p>
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
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Последняя синхронизация</CardTitle>
                <CardDescription>
                  {lastSync.completed_at ? formatDate(lastSync.completed_at) : "Выполняется..."}
                </CardDescription>
              </div>
              <Badge
                variant={
                  lastSync.status === "success" ? "default" : lastSync.status === "error" ? "destructive" : "secondary"
                }
              >
                {getStatusText(lastSync.status)}
              </Badge>
            </div>
          </CardHeader>
          {lastSync.status === "success" && lastSync.items_synced !== null && (
            <CardContent>
              <p className="text-sm text-muted-foreground">Синхронизировано товаров: {lastSync.items_synced}</p>
            </CardContent>
          )}
          {lastSync.status === "error" && lastSync.error_message && (
            <CardContent>
              <p className="text-sm text-destructive font-medium mb-1">Ошибка синхронизации:</p>
              <p className="text-sm text-destructive">{lastSync.error_message}</p>
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Товары</CardTitle>
              <CardDescription>Всего товаров: {products?.length || 0}</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input type="search" placeholder="Поиск товаров..." className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Товар</TableHead>
                <TableHead>Артикул</TableHead>
                <TableHead>Категория</TableHead>
                <TableHead>Цена</TableHead>
                <TableHead>Остаток</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="text-right">Действия</TableHead>
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
                    <TableRow key={product.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center overflow-hidden">
                            {product.image_url ? (
                              <img
                                src={product.image_url || "/placeholder.svg"}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {product.name && product.name !== product.sku ? product.name : product.sku}
                            </p>
                            <p className="text-xs text-muted-foreground">ID: {product.ozon_product_id}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">{product.sku}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{product.category || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {product.price ? (
                            <>
                              <span className="font-medium">
                                {Math.round(product.price)} {product.currency || "₽"}
                              </span>
                              {product.price_old && product.price_old > product.price && (
                                <span className="text-sm text-muted-foreground line-through">
                                  {Math.round(product.price_old)} {product.currency || "₽"}
                                </span>
                              )}
                            </>
                          ) : (
                            <span>—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${isLowStock ? "text-warning" : ""}`}>{stockLevel}</span>
                          {isLowStock && (
                            <Badge variant="outline" className="text-warning border-warning">
                              Мало
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.is_active ? "default" : "secondary"}>
                          {product.is_active ? "Активен" : "Неактивен"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
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
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-12 w-12 text-muted-foreground/50" />
                      <p className="text-base font-medium">Каталог пуст</p>
                      <p className="text-sm">Нажмите &quot;Синхронизировать с Ozon&quot; для импорта товаров</p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
