import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createConfig, http, injected, WagmiProvider } from 'wagmi'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './LiveApp'
import { GIWA_SEPOLIA, NETWORK_CONFIG } from './config/network'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
})

const config = createConfig({
  chains: [GIWA_SEPOLIA],
  connectors: [injected()],
  transports: {
    [GIWA_SEPOLIA.id]: http(NETWORK_CONFIG.rpcUrl),
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
