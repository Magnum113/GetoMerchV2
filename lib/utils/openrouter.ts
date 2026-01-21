const DEFAULT_OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

function hasScheme(value: string) {
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(value)
}

export function resolveOpenRouterUrl(rawUrl?: string | null) {
  if (!rawUrl) return DEFAULT_OPENROUTER_URL
  const trimmed = rawUrl.trim()
  if (!trimmed) return DEFAULT_OPENROUTER_URL

  if (trimmed.startsWith("/")) {
    return trimmed
  }

  const withScheme = hasScheme(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const url = new URL(withScheme)
    if (url.hostname.includes("openrouter.ai")) {
      const normalizedPath = url.pathname.replace(/\/+$/, "")
      if (!normalizedPath || normalizedPath === "/") {
        url.pathname = "/api/v1/chat/completions"
      } else if (normalizedPath.endsWith("/api/v1")) {
        url.pathname = `${normalizedPath}/chat/completions`
      } else if (!normalizedPath.endsWith("/chat/completions")) {
        url.pathname = `${normalizedPath}/chat/completions`
      }
    }
    return url.toString()
  } catch {
    return trimmed
  }
}
