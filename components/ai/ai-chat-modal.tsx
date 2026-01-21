"use client"

import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader2, MessageSquare, Send } from "lucide-react"
import { toast } from "sonner"

type ChatMessage = {
  id?: string
  role: "user" | "assistant"
  content: string
  created_at?: string
}

type ContextMeta = {
  generatedAt?: string
  salesWindowDays?: number
}

interface AIChatModalProps {
  isOpen: boolean
  onClose: () => void
}

const SESSION_KEY = "ai-chat-session-id"

function getOrCreateSessionId() {
  if (typeof window === "undefined") return null
  const existing = window.localStorage.getItem(SESSION_KEY)
  if (existing) return existing
  const newId = crypto.randomUUID()
  window.localStorage.setItem(SESSION_KEY, newId)
  return newId
}

export function AIChatModal({ isOpen, onClose }: AIChatModalProps) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [contextMeta, setContextMeta] = useState<ContextMeta | null>(null)
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const id = getOrCreateSessionId()
    setSessionId(id)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen || !sessionId) return
    const loadHistory = async () => {
      setIsLoadingHistory(true)
      try {
        const response = await fetch(`/api/ai/chat?sessionId=${sessionId}`)
        if (!response.ok) {
          throw new Error("Не удалось загрузить историю")
        }
        const data = await response.json()
        setMessages(data.messages || [])
      } catch (error) {
        toast.error("Не удалось загрузить историю чата")
      } finally {
        setIsLoadingHistory(false)
      }
    }
    loadHistory()
  }, [isOpen, sessionId])

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isSending])

  const handleSend = async () => {
    if (!input.trim() || !sessionId) return
    const userMessage: ChatMessage = { role: "user", content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsSending(true)

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: userMessage.content }),
      })

      if (!response.ok) {
        throw new Error("Ошибка ответа ИИ")
      }

      const data = await response.json()
      setMessages(data.messages || [])
      setContextMeta(data.contextMeta || null)
    } catch (error) {
      toast.error("Не удалось получить ответ от ИИ")
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            ИИ чат
          </DialogTitle>
          <DialogDescription>
            Задайте вопрос — ИИ отвечает на основе актуальных данных из базы
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <ScrollArea className="h-[420px] rounded-lg border border-gray-100 bg-white/70 p-4">
            {isLoadingHistory ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Загружаю историю...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Напишите первый вопрос для ИИ
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={message.id || `${message.role}-${index}`}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "bg-blue-600 text-white"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {message.content}
                    </div>
                  </div>
                ))}
                {isSending && (
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 rounded-2xl bg-gray-100 px-4 py-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      ИИ отвечает...
                    </div>
                  </div>
                )}
                <div ref={scrollAnchorRef} />
              </div>
            )}
          </ScrollArea>

          <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
            <Textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напишите вопрос. Например: «порекомендуй какие материалы заказать для футболок»"
              className="min-h-[90px] resize-none"
              disabled={isSending}
            />
            <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
              <div>
                {contextMeta?.generatedAt ? (
                  <>Данные обновлены: {new Date(contextMeta.generatedAt).toLocaleString("ru-RU")}</>
                ) : (
                  <>Данные обновляются при каждом запросе</>
                )}
              </div>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleSend}
                disabled={isSending || !input.trim()}
              >
                <Send className="h-4 w-4" />
                Отправить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
