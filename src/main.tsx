import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

const LIVE_QUERY_INTERVAL_MS = 5_000;
const ROUTER_BASENAME = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: LIVE_QUERY_INTERVAL_MS,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchInterval: LIVE_QUERY_INTERVAL_MS,
      refetchIntervalInBackground: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={ROUTER_BASENAME}>
        <TooltipProvider delayDuration={250} skipDelayDuration={0}>
          <App />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
