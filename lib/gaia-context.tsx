"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type UsageStats = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: string
}

export type GaiaSettings = {
  model: "haiku" | "sonnet" | "opus" | "fable"
  temperature: number
  mode: "casual" | "analysis" | "code" | "creative"
  language: string
  assistantName: string
}

export type Chat = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type GaiaContextType = {
  // Settings
  settings: GaiaSettings
  updateSettings: (s: Partial<GaiaSettings>) => void

  // Usage
  sessionUsage: { input: number; output: number; cost: number; messages: number }
  addUsage: (input: number, output: number, cost: number) => void

  totalUsage: { input: number; output: number; cost: number }
  setTotalUsage: (u: { input: number; output: number; cost: number }) => void

  // Chats
  chats: Chat[]
  setChats: (chats: Chat[]) => void
  activeChatId: string | null
  setActiveChatId: (id: string | null) => void
  chatsLoaded: boolean
  setChatsLoaded: (v: boolean) => void
  addChat: (chat: Chat) => void
  updateChatTitle: (id: string, title: string) => void

  // Badge
  chatCount: number
  setChatCount: (n: number) => void
}

const GaiaContext = createContext<GaiaContextType | null>(null)

export function GaiaProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<GaiaSettings>({
    model: "sonnet",
    temperature: 0.7,
    mode: "casual",
    language: "es",
    assistantName: "Gaia",
  })

  const [sessionUsage, setSessionUsage] = useState({ input: 0, output: 0, cost: 0, messages: 0 })
  const [totalUsage, setTotalUsage] = useState({ input: 0, output: 0, cost: 0 })
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("gaia-active-chat")
    return null
  })
  const [chatCount, setChatCount] = useState(0)
  const [chatsLoaded, setChatsLoaded] = useState(false)

  const updateSettings = useCallback((s: Partial<GaiaSettings>) => {
    setSettings((prev) => ({ ...prev, ...s }))
  }, [])

  const addUsage = useCallback((input: number, output: number, cost: number) => {
    setSessionUsage((prev) => ({
      input: prev.input + input,
      output: prev.output + output,
      cost: prev.cost + cost,
      messages: prev.messages + 1,
    }))
  }, [])

  const addChat = useCallback((chat: Chat) => {
    setChats((prev) => [chat, ...prev])
  }, [])

  const updateChatTitle = useCallback((id: string, title: string) => {
    setChats((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)))
  }, [])

  const setActiveChatIdPersisted = useCallback((id: string | null) => {
    setActiveChatId(id)
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("gaia-active-chat", id)
      else localStorage.removeItem("gaia-active-chat")
    }
  }, [])

  return (
    <GaiaContext.Provider value={{
      settings, updateSettings,
      sessionUsage, addUsage,
      totalUsage, setTotalUsage,
      chats, setChats,
      activeChatId, setActiveChatId: setActiveChatIdPersisted,
      addChat, updateChatTitle,
      chatCount, setChatCount,
      chatsLoaded, setChatsLoaded,
    }}>
      {children}
    </GaiaContext.Provider>
  )
}

export function useGaia() {
  const ctx = useContext(GaiaContext)
  if (!ctx) throw new Error("useGaia must be used inside GaiaProvider")
  return ctx
}