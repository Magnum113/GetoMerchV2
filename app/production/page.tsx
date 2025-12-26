import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Search, Clock, AlertCircle, CheckCircle, Factory, Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StartProductionButton } from "@/components/production/start-production-button"
import { CompleteProductionButton } from "@/components/production/complete-production-button"
import { CreateRecipeDialog } from "@/components/production/create-recipe-dialog"
import { EditRecipeDialog } from "@/components/production/edit-recipe-dialog"
import { AutoCreateRecipesButton } from "@/components/production/auto-create-recipes-button"

export default async function ProductionPage() {
  const supabase = await createClient()

  // Fetch production queue with product details
  const { data: productionQueue } = await supabase
    .from("production_queue")
    .select(
      `
      *,
      products(*),
      orders(order_number, customer_name)
    `,
    )
    .order("created_at", { ascending: false })

  // Fetch recipes with product and material details
  const { data: recipes } = await supabase
    .from("recipes")
    .select(
      `
      *,
      recipe_products(
        products(*)
      ),
      recipe_materials(
        *,
        material_definitions(id, name, unit, attributes)
      )
    `,
    )
    .eq("is_active", true)

  // Calculate statistics
  const pendingItems = productionQueue?.filter((p) => p.status === "pending").length || 0
  const inProgressItems = productionQueue?.filter((p) => p.status === "in_progress").length || 0
  const completedToday =
    productionQueue?.filter(
      (p) =>
        p.status === "completed" &&
        p.completed_at &&
        new Date(p.completed_at).toDateString() === new Date().toDateString(),
    ).length || 0

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—"
    return new Date(dateString).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-gray-50/50 min-h-screen">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Управление производством</h1>
          <p className="text-gray-600">Управление очередью производства и рецептами</p>
        </div>
        <Button className="shadow-sm hover:shadow-md transition-shadow">
          <Plus className="h-4 w-4 mr-2" />
          Добавить в очередь
        </Button>
      </div>

      {/* Statistics Cards - Улучшенный дизайн */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Ожидает</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{pendingItems}</div>
            <p className="text-xs text-gray-500 font-medium">Товаров в очереди</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-blue-50 to-blue-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">В производстве</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <Factory className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-blue-600 mb-1">{inProgressItems}</div>
            <p className="text-xs text-gray-500 font-medium">Производится сейчас</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-green-50 to-green-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Завершено сегодня</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600 mb-1">{completedToday}</div>
            <p className="text-xs text-gray-500 font-medium">Товаров готово</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-purple-50 to-purple-100/50">
            <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Активные рецепты</CardTitle>
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
              <Package className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-gray-900 mb-1">{recipes?.length || 0}</div>
            <p className="text-xs text-gray-500 font-medium">Готовы к производству</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="queue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="queue">Очередь производства</TabsTrigger>
          <TabsTrigger value="recipes">Рецепты</TabsTrigger>
        </TabsList>

        {/* Production Queue Tab */}
        <TabsContent value="queue" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Очередь производства</CardTitle>
                  <CardDescription>Товары запланированные к производству</CardDescription>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input type="search" placeholder="Поиск в очереди..." className="pl-9" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Товар</TableHead>
                    <TableHead>Количество</TableHead>
                    <TableHead>Приоритет</TableHead>
                    <TableHead>Заказ</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Срок</TableHead>
                    <TableHead>Начато</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productionQueue && productionQueue.length > 0 ? (
                    productionQueue.map((item) => {
                      const product = item.products

                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="font-medium">{product?.name}</div>
                            <div className="text-xs text-muted-foreground">SKU: {product?.sku}</div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{item.quantity} шт</span>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.priority === "high"
                                  ? "destructive"
                                  : item.priority === "normal"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {item.priority === "high" ? "Высокий" : item.priority === "normal" ? "Обычный" : "Низкий"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {item.orders ? (
                              <div>
                                <div className="text-sm font-medium">{item.orders.order_number}</div>
                                <div className="text-xs text-muted-foreground">{item.orders.customer_name}</div>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">На склад</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "completed"
                                  ? "default"
                                  : item.status === "in_progress"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {item.status === "completed"
                                ? "Завершено"
                                : item.status === "in_progress"
                                  ? "В процессе"
                                  : "Ожидает"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {item.due_date && new Date(item.due_date) < new Date() && item.status !== "completed" && (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              )}
                              <span className="text-sm">{formatDate(item.due_date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">{formatDate(item.started_at)}</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {item.status === "pending" && (
                                <StartProductionButton productionId={item.id} productName={product?.name || ""} />
                              )}
                              {item.status === "in_progress" && (
                                <CompleteProductionButton
                                  productionId={item.id}
                                  productId={item.product_id}
                                  quantity={item.quantity}
                                  productName={product?.name || ""}
                                />
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Нет товаров в очереди производства.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Recipes Tab */}
        <TabsContent value="recipes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Рецепты производства</CardTitle>
                  <CardDescription>Требования материалов для каждого товара</CardDescription>
                </div>
                <div className="flex gap-2">
                  <CreateRecipeDialog />
                  <AutoCreateRecipesButton />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recipes && recipes.length > 0 ? (
                  recipes.map((recipe) => {
                    const products = recipe.recipe_products?.map((rp: any) => rp.products).filter(Boolean) || []

                    return (
                      <Card key={recipe.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{recipe.name}</CardTitle>
                              <CardDescription>
                                {recipe.description}
                                {products.length > 0 && (
                                  <span className="block mt-1 text-xs">
                                    Товары: {products.map((p: any) => p.name).join(", ")}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                              {recipe.production_time_minutes && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {recipe.production_time_minutes} мин
                                </div>
                              )}
                              <EditRecipeDialog recipe={recipe} />
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Требуемые материалы:</div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {recipe.recipe_materials?.map((rm: any) => {
                                const materialDef = rm.material_definitions
                                const quantityRequired = rm.quantity_required || 0

                                return (
                                  <div
                                    key={rm.id}
                                    className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
                                  >
                                    <div>
                                      <div className="text-sm font-medium">{materialDef?.name || "Неизвестно"}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {Math.round(quantityRequired)} {materialDef?.unit || "шт"}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-muted-foreground">
                                        Будет выбрано автоматически (FIFO)
                                      </div>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })
                ) : (
                  <div className="text-center text-muted-foreground py-8">Рецепты не настроены.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
