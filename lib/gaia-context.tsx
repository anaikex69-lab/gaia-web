"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

export type UsageStats = {
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: string
}

export type GaiaSettings = {
  model: "haiku" | "sonnet" | "opus"
  temperature: number
  mode: "casual" | "analysis" | "code" | "creative"
  language: string
  assistantName: string
}

type GaiaContextType = {
  // Settings
  settings: GaiaSettings
  updateSettings: (s: Partial<GaiaSettings>) => void

  // Usage - sesión actual
  sessionUsage: { input: number; output: number; cost: number; messages: number }
  addUsage: (input: number, output: number, cost: number) => void

  // Usage - historial total (desde Supabase)
  totalUsage: { input: number; output: number; cost: number; messages: number } | null
  setTotalUsage: (t: { input: number; output: number; cost: number; messages: number }) => void

  // Badge de chats
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
  const [totalUsage, setTotalUsage] = useState<{ input: number; output: number; cost: number; messages: number } | null>(null)
  const [chatCount, setChatCount] = useState(0)

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

  return (
    <GaiaContext.Provider value={{
      settings, updateSettings,
      sessionUsage, addUsage,
      totalUsage, setTotalUsage,
      chatCount, setChatCount,
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
