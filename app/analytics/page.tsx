"use client"

import { useEffect, useState } from "react"
import { createBrowserClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Package, ShoppingCart, AlertTriangle, ArrowDownIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatNumber, formatCurrency, formatPercent } from "@/lib/utils/format"
import { DateRangePicker } from "@/components/analytics/date-range-picker"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from "recharts"

type MetricType = "revenue" | "orders"

function subtractDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() - days)
  return result
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: subtractDays(new Date(), 30),
    to: new Date(),
  })
  const [chartMetric, setChartMetric] = useState<"revenue" | "orders">("revenue")
  const [orders, setOrders] = useState<any[]>([])
  const [orderItems, setOrderItems] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [inventory, setInventory] = useState<any[]>([])
  const [materials, setMaterials] = useState<any[]>([])
  const [productionQueue, setProductionQueue] = useState<any[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [dateRange])

  const fetchData = async () => {
    setLoading(true)
    const supabase = createBrowserClient()

    let ordersQuery = supabase.from("orders").select("*")

    if (dateRange.from) {
      ordersQuery = ordersQuery.gte("order_date", dateRange.from.toISOString())
    }
    if (dateRange.to) {
      const toDate = new Date(dateRange.to)
      toDate.setHours(23, 59, 59, 999)
      ordersQuery = ordersQuery.lte("order_date", toDate.toISOString())
    }

    const [ordersResult, orderItemsResult, productsResult, inventoryResult, materialsResult, productionResult] = await Promise.all([
      ordersQuery,
      supabase.from("order_items").select(`
        *,
        products:product_id (
          id,
          name,
          sku,
          image_url,
          price
        ),
        orders:order_id (
          id,
          order_date,
          total_amount,
          status
        )
      `),
      supabase.from("products").select("*"),
      supabase.from("inventory").select("*"),
      supabase.from("materials").select("*"),
      supabase.from("production_queue").select("*"),
    ])

    const ordersData = ordersResult.data || []
    const orderItemsData = orderItemsResult.data || []
    const productsData = productsResult.data || []

    console.log("[v0] Analytics data loaded:", {
      ordersCount: ordersData.length,
      orderItemsCount: orderItemsData.length,
      dateRange: { from: dateRange.from, to: dateRange.to },
      firstOrder: ordersData[0],
      firstOrderItem: orderItemsData[0],
      productsCount: productsData.length,
      sampleProductFromOrderItem: orderItemsData[0]?.products ? (Array.isArray(orderItemsData[0].products) ? orderItemsData[0].products[0] : orderItemsData[0].products) : null,
      sampleProductFromProducts: productsData[0],
    })

    // Filter order items by date range
    const filteredOrderItems = orderItemsData.filter(item => {
      // Supabase returns orders as an object (single item) not an array
      const order = Array.isArray(item.orders) ? item.orders[0] : item.orders
      if (!order || !order.order_date) return false
      
      const orderDate = new Date(order.order_date)
      const moscowDate = new Date(orderDate.getTime() + 3 * 60 * 60 * 1000)
      return moscowDate >= dateRange.from && moscowDate <= dateRange.to
    })

    console.log("[DEBUG] Filtered order items:", {
      totalOrderItems: orderItemsData.length,
      filteredOrderItems: filteredOrderItems.length,
      sampleOrderItem: filteredOrderItems[0]
    })

    // Enrich orders with product data for compatibility
    const enrichedOrders = ordersData.map(order => {
      const product = productsData.find(p => p.id === order.product_id)
      return {
        ...order,
        products: product || null
      }
    })

    setOrders(enrichedOrders)
    setOrderItems(filteredOrderItems)
    setProducts(productsData)
    setInventory(inventoryResult.data || [])
    setMaterials(materialsResult.data || [])
    setProductionQueue(productionResult.data || [])

    const allDates: { [key: string]: { date: string; revenue: number; orders: number } } = {}

    const currentDate = new Date(dateRange.from)
    const endDate = new Date(dateRange.to)
    endDate.setHours(23, 59, 59, 999)

    // Заполняем все дни нулями
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split("T")[0]
      allDates[dateStr] = { date: dateStr, revenue: 0, orders: 0 }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    // Заполняем данными из реальных заказов
    ordersData.forEach((order: any) => {
      const orderDate = order.order_date || order.created_at
      const utcDate = new Date(orderDate)
      // Добавляем 3 часа для московского времени
      const moscowDate = new Date(utcDate.getTime() + 3 * 60 * 60 * 1000)
      const date = moscowDate.toISOString().split("T")[0]
      if (allDates[date]) {
        allDates[date].revenue += Number.parseFloat(order.total_amount) || 0
        allDates[date].orders += 1
      }
    })

    const chartDataArray = Object.values(allDates).sort(
      (a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    )

    console.log("[v0] Chart data generated:", {
      dataPoints: chartDataArray.length,
      firstPoint: chartDataArray[0],
      lastPoint: chartDataArray[chartDataArray.length - 1],
      totalRevenue: chartDataArray.reduce((sum: number, d: any) => sum + d.revenue, 0),
    })

    setChartData(chartDataArray)
    setLoading(false)
  }

  // Calculate analytics from current data
  const now = new Date()
  const thirtyDaysAgo = subtractDays(now, 30)
  const sevenDaysAgo = subtractDays(now, 7)
  const fourteenDaysAgo = subtractDays(now, 14)

  const filteredOrders = orders.filter((order) => {
    const orderDate = new Date(order.order_date || order.created_at)
    const moscowDate = new Date(orderDate.getTime() + 3 * 60 * 60 * 1000)
    return moscowDate >= dateRange.from && moscowDate <= dateRange.to
  })

  const thirtyDayOrders = orders.filter((order) => {
    const orderDate = new Date(order.order_date || order.created_at)
    const moscowDate = new Date(orderDate.getTime() + 3 * 60 * 60 * 1000)
    return moscowDate >= thirtyDaysAgo
  })

  const sevenDayOrders = orders.filter((order) => {
    const orderDate = new Date(order.order_date || order.created_at)
    const moscowDate = new Date(orderDate.getTime() + 3 * 60 * 60 * 1000)
    return moscowDate >= sevenDaysAgo
  })

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)
  const last30DaysRevenue = thirtyDayOrders.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)
  const last7DaysRevenue = sevenDayOrders.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)
  const avgOrderValue = filteredOrders.length > 0 ? totalRevenue / filteredOrders.length : 0

  const totalOrders = filteredOrders.length
  const last30DaysOrders = thirtyDayOrders.length
  const pendingOrders = filteredOrders.filter(
    (o) => o.status === "awaiting_packaging" || o.status === "awaiting_deliver",
  ).length
  const deliveredOrders = filteredOrders.filter((o) => o.status === "delivered").length
  const fulfilmentRate = totalOrders > 0 ? (deliveredOrders / totalOrders) * 100 : 0

  const totalStock = inventory.reduce((sum, item) => sum + item.quantity_in_stock, 0)
  const totalReserved = inventory.reduce((sum, item) => sum + item.quantity_reserved, 0)
  const lowStockProducts = inventory.filter((item) => item.available_quantity <= item.min_stock_level).length
  const availableStock = totalStock - totalReserved

  const inProductionCount = productionQueue.filter((p) => p.status === "in_progress").length
  const pendingProductionCount = productionQueue.filter((p) => p.status === "pending").length

  const previous7DaysRevenue = orders
    .filter((o) => {
      const date = new Date(o.order_date || o.created_at)
      const moscowDate = new Date(date.getTime() + 3 * 60 * 60 * 1000)
      return moscowDate >= fourteenDaysAgo && moscowDate < sevenDaysAgo
    })
    .reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)

  const revenueGrowth =
    previous7DaysRevenue > 0 ? ((last7DaysRevenue - previous7DaysRevenue) / previous7DaysRevenue) * 100 : (last7DaysRevenue > 0 ? 100 : 0)

  const sixtyDaysAgo = subtractDays(now, 60)
  const previous30DaysOrders = orders.filter((order) => {
    const orderDate = new Date(order.order_date || order.created_at)
    const moscowDate = new Date(orderDate.getTime() + 3 * 60 * 60 * 1000)
    return moscowDate >= sixtyDaysAgo && moscowDate < thirtyDaysAgo
  })

  const previous30DaysRevenue = previous30DaysOrders.reduce((sum, o) => sum + (Number.parseFloat(o.total_amount) || 0), 0)
  const revenueGrowth30Days =
    previous30DaysRevenue > 0 ? ((last30DaysRevenue - previous30DaysRevenue) / previous30DaysRevenue) * 100 : (last30DaysRevenue > 0 ? 100 : 0)

  console.log('[DEBUG] Revenue calculations:', {
    last7DaysRevenue,
    previous7DaysRevenue,
    revenueGrowth,
    last30DaysRevenue,
    previous30DaysRevenue,
    revenueGrowth30Days,
    sevenDayOrdersCount: sevenDayOrders.length,
    previous30DaysOrdersCount: previous30DaysOrders.length
  })

  console.log('[DEBUG] Orders data sample:', {
    totalOrders: filteredOrders.length,
    sampleOrder: filteredOrders[0],
    ordersWithProducts: filteredOrders.filter(o => o.product_id).length,
    orderItemsCount: orderItems.length,
    sampleOrderItem: orderItems[0]
  })

  const productionCompletionRate = productionQueue.length > 0 ? (inProductionCount / productionQueue.length) * 100 : 0

  const topSellingProductsObj = orderItems.reduce(
    (acc, item) => {
      // Extract product data from order_item structure
      // Supabase returns products as an object (single item) not an array
      const product = Array.isArray(item.products) ? item.products[0] : item.products
      const productId = product?.id || item.product_id
      
      // Skip items without valid product
      if (!productId) return acc
      
      // Get product name - check if name is different from sku (to avoid showing SKU as name)
      const rawProductName = product?.name || ""
      const productSku = product?.sku || ""
      
      // If name is the same as sku or empty, it means name wasn't enriched, use sku as fallback
      // But we'll try to get name from products array first
      let productName = rawProductName
      if (!productName || productName === productSku) {
        // Try to find product in products array
        const fullProduct = products.find(p => p.id === productId)
        if (fullProduct?.name && fullProduct.name !== fullProduct.sku) {
          productName = fullProduct.name
        } else {
          // If still no good name, use sku but mark it
          productName = productSku || "Неизвестный товар"
        }
      }
      
      const productImage = product?.image_url || product?.image || "/placeholder.jpg"
      
      if (!acc[productId]) {
        acc[productId] = {
          name: productName,
          sku: productSku,
          image: productImage,
          totalQuantity: 0,
          totalRevenue: 0,
        }
      }
      
      // Use actual quantity from order_item
      const quantity = Number(item.quantity) || 1
      const price = Number.parseFloat(item.price) || 0
      const itemRevenue = quantity * price
      
      acc[productId].totalQuantity += quantity
      acc[productId].totalRevenue += itemRevenue
      
      return acc
    },
    {} as Record<string, { name: string; sku: string; image: string; totalQuantity: number; totalRevenue: number }>,
  )

  const topSellingProducts = Object.values(topSellingProductsObj)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 5)

  // Debug: Check product names
  const sampleOrderItem = orderItems.find(item => {
    const product = Array.isArray(item.products) ? item.products[0] : item.products
    return product?.id
  })
  if (sampleOrderItem) {
    const sampleProduct = Array.isArray(sampleOrderItem.products) ? sampleOrderItem.products[0] : sampleOrderItem.products
    console.log('[DEBUG] Sample order item product data:', {
      productId: sampleProduct?.id,
      productName: sampleProduct?.name,
      productSku: sampleProduct?.sku,
      nameEqualsSku: sampleProduct?.name === sampleProduct?.sku,
      fromProductsArray: products.find(p => p.id === sampleProduct?.id)
    })
  }

  console.log('[DEBUG] Top selling products calculation:', {
    orderItemsLength: orderItems.length,
    orderItemsWithProducts: orderItems.filter(o => o.products || o.product_id).length,
    topSellingProductsCount: Object.keys(topSellingProductsObj).length,
    topSellingProducts: topSellingProducts.map(p => ({
      name: p.name,
      sku: p.sku,
      nameEqualsSku: p.name === p.sku
    }))
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50/50 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Загрузка данных...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Аналитика</h1>
            <p className="text-gray-600">Обзор ключевых метрик и показателей эффективности</p>
          </div>
          <DateRangePicker dateRange={dateRange} onDateRangeChange={setDateRange} />
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden relative bg-gradient-to-br from-blue-500 to-blue-600">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
            <CardHeader className="pb-3 relative">
              <CardTitle className="text-xs font-semibold text-blue-100 uppercase tracking-wide">Общая выручка</CardTitle>
            </CardHeader>
            <CardContent className="relative pt-6">
              <div className="text-3xl font-bold text-white mb-3">{formatCurrency(totalRevenue)}</div>
              <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm font-medium">
                {formatNumber(totalOrders)} заказов
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-green-50 to-green-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">За 30 дней</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                {revenueGrowth30Days >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowDownIcon className="h-5 w-5 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900 mb-3">{formatCurrency(last30DaysRevenue)}</div>
              <div className="flex items-center gap-2">
                {revenueGrowth30Days > 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-600" />
                ) : revenueGrowth30Days < 0 ? (
                  <ArrowDownIcon className="h-4 w-4 text-red-600" />
                ) : (
                  <TrendingUp className="h-4 w-4 text-gray-400" />
                )}
                <span className="text-sm font-medium" style={{ color: revenueGrowth30Days >= 0 ? (revenueGrowth30Days > 0 ? '#10b981' : '#9ca3af') : '#ef4444' }}>
                  {revenueGrowth30Days >= 0 ? '+' : ''}{formatPercent(revenueGrowth30Days)}
                </span>
              </div>
              <div className="text-xs text-gray-500 font-medium mt-1">
                {formatNumber(last30DaysOrders)} заказов
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-purple-50 to-purple-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">За 7 дней</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                {revenueGrowth >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-green-600" />
                ) : (
                  <ArrowDownIcon className="h-5 w-5 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900 mb-3">{formatCurrency(last7DaysRevenue)}</div>
              <div className="flex items-center gap-2">
                {revenueGrowth >= 0 ? (
                  <>
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">+{formatPercent(revenueGrowth)}</span>
                  </>
                ) : (
                  <>
                    <ArrowDownIcon className="h-4 w-4 text-red-600" />
                    <span className="text-sm text-red-600 font-medium">{formatPercent(revenueGrowth)}</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Средний чек</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <ShoppingCart className="h-5 w-5 text-amber-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900 mb-3">{formatCurrency(avgOrderValue)}</div>
              <span className="text-xs text-gray-500 font-medium">На один заказ</span>
            </CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">
                  {chartMetric === "revenue" ? "Динамика выручки" : "Динамика заказов"}
                </CardTitle>
                <CardDescription className="text-sm">
                  {chartMetric === "revenue" ? "Выручка по дням за выбранный период" : "Количество заказов по дням"}
                </CardDescription>
              </div>
              <Tabs value={chartMetric} onValueChange={(v) => setChartMetric(v as MetricType)}>
                <TabsList className="bg-gray-100">
                  <TabsTrigger value="revenue" className="font-medium">Выручка</TabsTrigger>
                  <TabsTrigger value="orders" className="font-medium">Заказы</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[400px]">
              <ResponsiveContainer width="100%" height="100%">
                {chartMetric === "revenue" ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("ru", { day: "2-digit", month: "short" })
                      }
                    />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(value) => formatNumber(value)} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">
                                {new Date(payload[0].payload.date).toLocaleDateString("ru", {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Legend />
                  </LineChart>
                ) : (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) =>
                        new Date(value).toLocaleDateString("ru", { day: "2-digit", month: "short" })
                      }
                    />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">
                                {new Date(payload[0].payload.date).toLocaleDateString("ru", {
                                  day: "2-digit",
                                  month: "long",
                                  year: "numeric",
                                })}
                              </p>
                              <p className="text-sm font-bold text-gray-900">
                                {formatNumber(payload[0].value as number)} заказов
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar dataKey="orders" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                    <Legend />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-lg font-semibold">Эффективность выполнения</CardTitle>
            <CardDescription className="text-sm">Статистика обработки и доставки заказов</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Всего заказов</div>
                <div className="text-3xl font-bold text-gray-900">{formatNumber(totalOrders)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">Доставлено</div>
                <div className="text-3xl font-bold text-green-600">{formatNumber(deliveredOrders)}</div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-gray-600">В обработке</div>
                <div className="text-3xl font-bold text-orange-600">{formatNumber(pendingOrders)}</div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Процент выполнения</span>
                  <span className="text-sm font-bold text-green-600">{formatPercent(fulfilmentRate)}</span>
                </div>
                <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="absolute h-full bg-gradient-to-r from-green-500 to-green-600 rounded-full transition-all duration-500"
                    style={{ width: `${fulfilmentRate}%` }}
                  />
                </div>
              </div>

              {totalOrders > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">В обработке</span>
                    <span className="text-sm font-bold text-orange-600">
                      {formatPercent((pendingOrders / totalOrders) * 100)}
                    </span>
                  </div>
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="absolute h-full bg-gradient-to-r from-orange-500 to-orange-600 rounded-full transition-all duration-500"
                      style={{ width: `${(pendingOrders / totalOrders) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-soft">
          <CardHeader className="border-b border-gray-100 pb-4">
            <CardTitle className="text-lg font-semibold">Топ продаж</CardTitle>
            <CardDescription className="text-sm">Лучшие товары по объёму</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSellingProducts.length > 0 ? (
                topSellingProducts.map((product, index) => (
                  <div
                    key={product.sku}
                    className="flex items-center gap-4 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-sm font-bold text-white shadow-md">
                      {index + 1}
                    </div>
                    <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-gray-100 border border-gray-200">
                      <img
                        src={product.image || "/placeholder.jpg"}
                        alt={product.name}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement
                          target.src = "/placeholder.jpg"
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{product.name}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-lg font-bold text-gray-900">{formatNumber(product.totalQuantity)}</div>
                      <div className="text-xs text-gray-500">шт • {formatCurrency(product.totalRevenue)}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p>{orderItems.length > 0 ? 'Нет данных о товарах в заказах' : 'Нет данных о продажах'}</p>
                  {orderItems.length > 0 && (
                    <p className="text-xs mt-2 text-gray-400">Товары в заказах есть, но информация о продуктах отсутствует</p>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-blue-50 to-blue-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Запасы на складе</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(totalStock)}</div>
              <div className="text-xs text-gray-500 font-medium mb-3">{formatNumber(availableStock)} доступно</div>
              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Зарезервировано: {formatNumber(totalReserved)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-amber-50 to-amber-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Низкие остатки</CardTitle>
              <div className={`h-10 w-10 rounded-lg ${lowStockProducts > 0 ? "bg-amber-500/10" : "bg-green-500/10"} flex items-center justify-center group-hover:${lowStockProducts > 0 ? "bg-amber-500/20" : "bg-green-500/20"} transition-colors`}>
                <AlertTriangle className={`h-5 w-5 ${lowStockProducts > 0 ? "text-amber-600" : "text-green-600"}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className={`text-3xl font-bold mb-1 ${lowStockProducts > 0 ? "text-amber-600" : "text-green-600"}`}>
                {formatNumber(lowStockProducts)}
              </div>
              <div className="text-xs text-gray-500 font-medium mb-3">Товаров требуют внимания</div>
              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">Товаров: {lowStockProducts}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-3 pt-3 bg-gradient-to-br from-purple-50 to-purple-100/50">
              <CardTitle className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Производство</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-gray-900 mb-1">{formatNumber(inProductionCount)}</div>
              <div className="text-xs text-gray-500 font-medium mb-3">В работе</div>
              <div className="pt-3 border-t border-gray-100">
                <div className="text-xs text-gray-500">В очереди: {formatNumber(pendingProductionCount)}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-soft hover:shadow-medium transition-all hover-lift overflow-hidden group bg-gradient-to-br from-purple-50 to-purple-100/30">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-xs font-semibold text-purple-700 uppercase tracking-wide">Материалы</CardTitle>
              <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <Package className="h-5 w-5 text-purple-600" />
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-purple-900 mb-1">{formatNumber(materials.length)}</div>
              <div className="text-xs text-purple-700 font-medium mb-3">
                Низкий уровень: {formatNumber(materials.filter((m) => m.quantity_in_stock <= m.min_stock_level).length)}
              </div>
            </CardContent>
          </Card>
        </div>

        {(lowStockProducts > 0 || last30DaysRevenue > 0 || inProductionCount > 0) && (
          <Card className="border-0 shadow-soft">
            <CardHeader className="border-b border-gray-100 pb-4">
              <CardTitle className="text-lg font-semibold">Ключевые инсайты</CardTitle>
              <CardDescription className="text-sm">Важные показатели и рекомендации</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {last30DaysRevenue > 0 && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-blue-100/50 border border-blue-200/50">
                    <div className="h-10 w-10 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
                      <TrendingUp className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-blue-900">Динамика выручки</div>
                      <div className="text-sm text-gray-700 mt-1">
                        За последние 30 дней выручка составила {formatCurrency(last30DaysRevenue)} из{" "}
                        {formatNumber(last30DaysOrders)} заказов. {revenueGrowth >= 0 ? "Рост" : "Снижение"} за неделю:{" "}
                        <span
                          className={revenueGrowth >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}
                        >
                          {revenueGrowth >= 0 ? "+" : ""}
                          {formatPercent(revenueGrowth)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {lowStockProducts > 0 && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-orange-50 to-orange-100/50 border border-orange-200/50">
                    <div className="h-10 w-10 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
                      <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-orange-900">Внимание: низкие запасы товаров</div>
                      <div className="text-sm text-gray-700 mt-1">
                        {formatNumber(lowStockProducts)} товаров ниже минимального уровня. Рассмотрите создание заявок
                        на пополнение.
                      </div>
                    </div>
                  </div>
                )}

                {inProductionCount > 0 && (
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-gradient-to-r from-purple-50 to-purple-100/50 border border-purple-200/50">
                    <div className="h-10 w-10 rounded-xl bg-purple-500 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-purple-900">Очередь производства</div>
                      <div className="text-sm text-gray-700 mt-1">
                        {formatNumber(inProductionCount)} товаров в работе. Текущий прогресс выполнения:{" "}
                        {formatPercent(productionCompletionRate)}. Рассмотрите запуск производственных серий.
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
