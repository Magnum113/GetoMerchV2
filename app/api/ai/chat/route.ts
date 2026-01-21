import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildChatContext, generateFallbackChatResponse } from "@/lib/services/ai-context-service"
import { resolveOpenRouterUrl } from "@/lib/utils/openrouter"

const HISTORY_DAYS = 7
const MAX_HISTORY_MESSAGES = 30
const MAX_PROMPT_MESSAGES = 12

function getCutoffIso() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - HISTORY_DAYS)
  return cutoff.toISOString()
}

async function cleanupOldMessages(supabase: any) {
  const cutoffIso = getCutoffIso()
  await supabase.from("ai_chat_messages").delete().lt("created_at", cutoffIso)
}

async function getRecentMessages(supabase: any, sessionId: string) {
  const cutoffIso = getCutoffIso()
  const { data } = await supabase
    .from("ai_chat_messages")
    .select("id, role, content, created_at")
    .eq("session_id", sessionId)
    .gte("created_at", cutoffIso)
    .order("created_at", { ascending: true })
    .limit(MAX_HISTORY_MESSAGES)

  return data || []
}

async function requestOpenRouter({
  apiUrl,
  apiKey,
  model,
  messages,
}: {
  apiUrl: string
  apiKey: string
  model: string
  messages: Array<{ role: string; content: string }>
}) {
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.6,
      max_tokens: 400,
    }),
  })

  const rawBody = await response.text()
  if (!response.ok) {
    console.error("OpenRouter API error:", rawBody.slice(0, 500))
    return null
  }

  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("application/json")) {
    console.error("OpenRouter API returned non-JSON response:", rawBody.slice(0, 200))
    return null
  }

  try {
    const parsed = JSON.parse(rawBody)
    return parsed.choices?.[0]?.message?.content || null
  } catch (error) {
    console.error("OpenRouter API JSON parse error:", error, rawBody.slice(0, 200))
    return null
  }
}

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 })
  }

  const supabase = await createClient()
  await cleanupOldMessages(supabase)

  const messages = await getRecentMessages(supabase, sessionId)
  return NextResponse.json({ messages })
}

export async function POST(request: NextRequest) {
  try {
    const { sessionId, message } = await request.json()

    if (!sessionId || !message || typeof message !== "string") {
      return NextResponse.json({ error: "sessionId and message are required" }, { status: 400 })
    }

    const supabase = await createClient()
    await cleanupOldMessages(supabase)

    await supabase.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "user",
      content: message,
    })

    const history = await getRecentMessages(supabase, sessionId)
    const context = await buildChatContext(supabase)

    const trimmedHistory = history.slice(-MAX_PROMPT_MESSAGES).map((item: any) => ({
      role: item.role,
      content: item.content,
    }))

    const systemPrompt =
      "Ты аналитик по продажам и запасам для бизнеса на Ozon. Отвечай по-русски, кратко и по делу. Если данных недостаточно — уточни, какие данные нужны."
    const contextPrompt = `Актуальные данные (JSON): ${JSON.stringify(context)}`

    const openRouterApiKey = process.env.OPENROUTER_API_KEY
    const openRouterApiUrl = resolveOpenRouterUrl(process.env.OPENROUTER_API_URL)
    const openRouterModel = process.env.OPENROUTER_MODEL

    let reply: string | null = null

    if (openRouterApiKey && openRouterApiUrl && openRouterModel) {
      reply = await requestOpenRouter({
        apiUrl: openRouterApiUrl,
        apiKey: openRouterApiKey,
        model: openRouterModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "system", content: contextPrompt },
          ...trimmedHistory,
        ],
      })
    }

    if (!reply) {
      reply = generateFallbackChatResponse(context, message)
    }

    await supabase.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      content: reply,
    })

    const messages = await getRecentMessages(supabase, sessionId)

    return NextResponse.json({
      reply,
      messages,
      contextMeta: {
        generatedAt: context.generatedAt,
        salesWindowDays: context.salesWindowDays,
      },
    })
  } catch (error) {
    console.error("AI Chat Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Неизвестная ошибка" },
      { status: 500 },
    )
  }
}
