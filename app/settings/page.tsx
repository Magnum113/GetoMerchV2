import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { TestOzonButton } from "@/components/settings/test-ozon-button"
import { TestProductInfoButton } from "@/components/settings/test-product-info-button"
import { SyncCategoriesButton } from "@/components/catalog/sync-categories-button"

export default async function SettingsPage() {
  const supabase = await createClient()

  const hasClientId = !!process.env.OZON_CLIENT_ID
  const hasApiKey = !!process.env.OZON_API_KEY
  const apiUrl = process.env.OZON_API_URL || "https://api-seller.ozon.ru"
  const isConfigured = hasClientId && hasApiKey

  const { count: categoriesCount } = await supabase.from("ozon_categories").select("*", { count: "exact", head: true })

  const { data: recentSyncs } = await supabase
    .from("sync_log")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
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

  const getSyncTypeText = (type: string) => {
    switch (type) {
      case "products":
        return "Товары"
      case "orders":
        return "Заказы"
      case "stocks":
        return "Остатки"
      default:
        return type
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки</h1>
        <p className="text-gray-600 mt-1">Конфигурация интеграции с Ozon и настройки системы</p>
      </div>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Статус интеграции Ozon</CardTitle>
          <CardDescription>Проверка подключения к Ozon Seller API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfigured ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertTitle className="text-green-900">Конфигурация завершена</AlertTitle>
              <AlertDescription className="text-green-700">
                Ключи Ozon API настроены. Вы можете синхронизировать товары и заказы.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive" className="bg-red-50 border-red-200">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertTitle className="text-red-900">Требуется настройка</AlertTitle>
              <AlertDescription className="text-red-700">
                Добавьте переменные окружения в настройках проекта:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>OZON_CLIENT_ID - Client ID из личного кабинета Ozon</li>
                  <li>OZON_API_KEY - API Key из личного кабинета Ozon</li>
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
              <span className="text-sm font-medium text-gray-900">Client ID</span>
              {hasClientId ? (
                <Badge variant="default" className="gap-1 bg-green-100 text-green-700 hover:bg-green-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Настроен
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Отсутствует
                </Badge>
              )}
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg bg-gray-50">
              <span className="text-sm font-medium text-gray-900">API Key</span>
              {hasApiKey ? (
                <Badge variant="default" className="gap-1 bg-green-100 text-green-700 hover:bg-green-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Настроен
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Отсутствует
                </Badge>
              )}
            </div>
          </div>

          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm font-medium text-gray-900 mb-1">API URL</p>
            <code className="text-xs text-gray-600">{apiUrl}</code>
          </div>

          {isConfigured && (
            <>
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">Категории Ozon</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {categoriesCount ? `В базе данных: ${categoriesCount} категорий` : "Категории не загружены"}
                    </p>
                  </div>
                </div>
                {!categoriesCount || categoriesCount === 0 ? (
                  <Alert className="bg-yellow-50 border-yellow-200 mb-3">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <AlertDescription className="text-yellow-700 text-sm">
                      Рекомендуется сначала синхронизировать категории, чтобы в каталоге товаров отображались названия
                      категорий вместо ID.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <SyncCategoriesButton />
              </div>

              <div className="pt-4 border-t space-y-3">
                <p className="text-sm font-medium text-gray-900 mb-2">Диагностика API</p>
                <TestOzonButton />
                <TestProductInfoButton />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="bg-white">
        <CardHeader>
          <CardTitle>История синхронизаций</CardTitle>
          <CardDescription>Последние операции синхронизации с Ozon</CardDescription>
        </CardHeader>
        <CardContent>
          {recentSyncs && recentSyncs.length > 0 ? (
            <div className="space-y-3">
              {recentSyncs.map((sync) => (
                <div
                  key={sync.id}
                  className="flex items-start justify-between p-3 border border-gray-200 rounded-lg bg-gray-50"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-gray-900">{getSyncTypeText(sync.sync_type)}</span>
                      <Badge
                        variant={
                          sync.status === "success" ? "default" : sync.status === "error" ? "destructive" : "secondary"
                        }
                      >
                        {getStatusText(sync.status)}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-600">{sync.started_at && formatDate(sync.started_at)}</p>
                    {sync.status === "success" && sync.items_synced !== null && (
                      <p className="text-xs text-gray-600 mt-1">Обработано элементов: {sync.items_synced}</p>
                    )}
                    {sync.status === "error" && sync.error_message && (
                      <p className="text-xs text-red-600 mt-1">{sync.error_message}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">История синхронизаций пуста</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
