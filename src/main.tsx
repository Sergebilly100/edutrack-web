import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { registerSW } from "virtual:pwa-register"
import "@fontsource-variable/inter"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from "@/shared/api/query-client"
import { ThemeProvider } from "@/shared/providers/ThemeProvider"
import { installOfflineProcessors } from "@/shared/store/offline-processors"
import App from "./App"
import "./index.css"

registerSW({ immediate: true })

// Enregistrement global des processors offline pour les mutations critiques.
// Doit s'exécuter avant le premier sync (useAutoSync dans App).
installOfflineProcessors()

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <TooltipProvider delayDuration={0}>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <QueryClientProvider client={queryClient}>
            <App />
            <Toaster />
          </QueryClientProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </React.StrictMode>
)
