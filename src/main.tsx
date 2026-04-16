import React from "react"
import ReactDOM from "react-dom/client"
import { QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter } from "react-router-dom"
import { registerSW } from "virtual:pwa-register"
import "@fontsource-variable/inter"
import { Toaster } from "@/components/ui/toaster"
import { queryClient } from "@/shared/api/query-client"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ThemeProvider } from "@/shared/providers/ThemeProvider"
import App from "./App"
import "./index.css"

registerSW({ immediate: true })

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <App />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
)
