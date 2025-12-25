export class OzonClient {
  private clientId: string
  private apiKey: string
  private baseUrl: string

  constructor() {
    this.clientId = process.env.OZON_CLIENT_ID || ""
    this.apiKey = process.env.OZON_API_KEY || ""
    this.baseUrl = process.env.OZON_API_URL || "https://api-seller.ozon.ru"
  }

  private maskApiKey(key: string): string {
    if (key.length <= 4) return "****"
    return "****" + key.slice(-4)
  }

  private async request(endpoint: string, method = "POST", body?: unknown) {
    const startTime = Date.now()
    const url = `${this.baseUrl}${endpoint}`

    console.log("[v0] Ozon API Request:", {
      method,
      endpoint,
      url,
      hasClientId: !!this.clientId,
      clientIdMasked: this.clientId ? this.maskApiKey(this.clientId) : "отсутствует",
      hasApiKey: !!this.apiKey,
      apiKeyMasked: this.apiKey ? this.maskApiKey(this.apiKey) : "отсутствует",
    })

    if (!this.clientId || !this.apiKey) {
      const error = "Ошибка: не заданы OZON_CLIENT_ID или OZON_API_KEY"
      console.error("[v0] Ozon API Error:", error)
      throw new Error(error)
    }

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "Client-Id": this.clientId,
          "Api-Key": this.apiKey,
        },
        body: body ? JSON.stringify(body) : undefined,
      })

      const responseTime = Date.now() - startTime

      console.log("[v0] Ozon API Response:", {
        endpoint,
        status: response.status,
        statusText: response.statusText,
        responseTime: `${responseTime}ms`,
        ok: response.ok,
      })

      if (!response.ok) {
        let errorMessage = `Ozon API вернул ${response.status}`
        let errorBody: string | undefined

        try {
          const errorData = await response.text()
          errorBody = errorData.substring(0, 2000)
          console.error("[v0] Ozon API Error Body:", errorBody)

          try {
            const errorJson = JSON.parse(errorData)
            if (errorJson.message) {
              errorMessage += `: ${errorJson.message}`
            }
          } catch {
            // Not JSON
          }
        } catch {
          // Failed to read body
        }

        if (response.status === 401) {
          errorMessage = "Ozon API вернул 401: проверьте правильность ключей (Client-Id и Api-Key)"
        } else if (response.status === 403) {
          errorMessage = "Ozon API вернул 403: нет прав доступа у ключа API"
        } else if (response.status === 429) {
          errorMessage = "Ozon API вернул 429: превышен лимит запросов, повторите позже"
        } else if (response.status >= 500) {
          errorMessage = `Ozon API вернул ${response.status}: ошибка на стороне сервера Ozon`
        }

        console.error("[v0] Ozon API Error:", {
          status: response.status,
          message: errorMessage,
          errorBody: errorBody?.substring(0, 500),
        })

        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log("[v0] Ozon API Success:", {
        endpoint,
        responseTime: `${responseTime}ms`,
        dataKeys: Object.keys(data),
      })

      return data
    } catch (error) {
      const responseTime = Date.now() - startTime

      if (error instanceof Error) {
        if (error.message.includes("Ozon API")) {
          throw error
        }

        const networkError = "Ошибка сети при обращении к Ozon API: " + error.message
        console.error("[v0] Ozon Network Error:", {
          endpoint,
          responseTime: `${responseTime}ms`,
          error: error.message,
          stack: error.stack?.split("\n").slice(0, 3).join("\n"),
        })
        throw new Error(networkError)
      }

      throw new Error("Неизвестная ошибка при обращении к Ozon API")
    }
  }

  async getProducts(limit = 100, lastId = "") {
    const requestBody = {
      filter: {
        visibility: "ALL",
      },
      last_id: lastId,
      limit,
    }

    console.log("[v0] getProducts request body:", JSON.stringify(requestBody, null, 2))

    const response = await this.request("/v3/product/list", "POST", requestBody)

    console.log("[v0] getProducts response keys:", Object.keys(response))
    console.log("[v0] getProducts result keys:", response.result ? Object.keys(response.result) : "no result")
    console.log("[v0] getProducts items count:", response.result?.items?.length || 0)
    console.log("[v0] getProducts last_id:", response.result?.last_id || "none")

    if (response.result?.items?.length === 0) {
      console.log(
        "[v0] WARNING: Ozon API returned 0 items. Response snippet:",
        JSON.stringify(response).substring(0, 2000),
      )
    }

    return response
  }

  async getProductInfo(productIds: number[], offerIds?: string[]) {
    const requestBody: {
      product_id?: string[]
      offer_id?: string[]
    } = {}

    if (productIds && productIds.length > 0) {
      requestBody.product_id = productIds.map((id) => String(id))
    }

    if (offerIds && offerIds.length > 0) {
      requestBody.offer_id = offerIds
    }

    const requestSnippet = JSON.stringify(requestBody).substring(0, 200)
    console.log("[v0] getProductInfo request snippet (first 200 chars):", requestSnippet)
    console.log("[v0] getProductInfo request - product_id count:", requestBody.product_id?.length || 0)
    console.log("[v0] getProductInfo request - offer_id count:", requestBody.offer_id?.length || 0)

    const response = await this.request("/v3/product/info/list", "POST", requestBody)

    console.log("[v0] getProductInfo response - Object.keys:", Object.keys(response))

    const rawItems = response.items || []
    console.log("[v0] getProductInfo response - rawItems.length (что пришло от Ozon):", rawItems.length)

    if (rawItems.length === 0) {
      console.log("[v0] WARNING: getProductInfo returned 0 items")
      console.log("[v0] Response snippet:", JSON.stringify(response).substring(0, 500))
    } else {
      const sampleItems = rawItems.slice(0, 2).map((item: any) => ({
        offer_id: item.offer_id,
        name: item.name?.substring(0, 50),
        has_price: !!item.min_price,
        has_images: !!item.images?.length,
      }))
      console.log("[v0] getProductInfo - примеры полученных товаров:", JSON.stringify(sampleItems, null, 2))
    }

    return response
  }

  async getProductStocks(productIds: number[]) {
    return this.request("/v3/product/info/stocks", "POST", {
      filter: {
        product_id: productIds,
        visibility: "ALL",
      },
      limit: 1000,
    })
  }

  async getCategoryTree(language = "RU") {
    console.log("[v0] getCategoryTree - запрос дерева категорий...")
    const response = await this.request("/v1/description-category/tree", "POST", {
      language,
    })

    console.log("[v0] getCategoryTree - получено категорий:", response.result?.length || 0)
    return response
  }

  async getOrders(status?: string, since?: string, to?: string, offset = 0) {
    const requestBody: any = {
      dir: "ASC",
      filter: {
        since: since || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        to: to || new Date().toISOString(),
      },
      limit: 1000,
      offset,
      with: {
        analytics_data: true,
        financial_data: true,
      },
    }

    console.log("[v0] getOrders request:", {
      since: requestBody.filter.since,
      to: requestBody.filter.to,
      limit: requestBody.limit,
      offset,
    })

    const response = await this.request("/v3/posting/fbs/list", "POST", requestBody)

    console.log("[v0] getOrders response:", {
      postings_count: response.result?.postings?.length || 0,
      has_more: response.result?.has_next || false,
      offset,
    })

    return response
  }

  async updateOrderStatus(postingNumber: string, status: string) {
    console.log("[v0] updateOrderStatus called with:", { postingNumber, status })
    return this.request("/v4/posting/fbs/ship", "POST", {
      packages: [
        {
          posting_number: postingNumber,
        },
      ],
    })
  }
}
