import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, Search, Clock, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { StartProductionButton } from "@/components/production/start-production-button"
import { CompleteProductionButton } from "@/components/production/complete-production-button"

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
      products(*),
      recipe_materials(
        *,
        materials(*)
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Управление производством</h1>
          <p className="text-muted-foreground mt-1">Управление очередью производства и рецептами</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Добавить в очередь
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ожидает</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Товаров в очереди</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">В производстве</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{inProgressItems}</div>
            <p className="text-xs text-muted-foreground mt-1">Производится сейчас</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Завершено сегодня</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{completedToday}</div>
            <p className="text-xs text-muted-foreground mt-1">Товаров готово</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Активные рецепты</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recipes?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Готовы к производству</p>
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
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Создать рецепт
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recipes && recipes.length > 0 ? (
                  recipes.map((recipe) => {
                    const product = recipe.products

                    return (
                      <Card key={recipe.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-base">{recipe.name}</CardTitle>
                              <CardDescription>{recipe.description}</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                              {recipe.production_time_minutes && (
                                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                  <Clock className="h-4 w-4" />
                                  {recipe.production_time_minutes} мин
                                </div>
                              )}
                              <Button variant="outline" size="sm">
                                Изменить
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <div className="text-sm font-medium">Требуемые материалы:</div>
                            <div className="grid gap-2 md:grid-cols-2">
                              {recipe.recipe_materials?.map((rm) => {
                                const material = rm.materials
                                const hasEnough = material && material.quantity_in_stock >= rm.quantity_needed

                                return (
                                  <div
                                    key={rm.id}
                                    className="flex items-center justify-between p-2 rounded-md bg-secondary/50"
                                  >
                                    <div>
                                      <div className="text-sm font-medium">{material?.name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {Math.round(rm.quantity_needed)} {material?.unit}
                                      </div>
                                    </div>
                                    <div className="text-right">
                                      <div className={`text-sm font-medium ${!hasEnough ? "text-warning" : ""}`}>
                                        {Math.round(material?.quantity_in_stock || 0)} доступно
                                      </div>
                                      {!hasEnough && (
                                        <Badge variant="outline" className="text-xs text-warning border-warning">
                                          Недостаточно
                                        </Badge>
                                      )}
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
