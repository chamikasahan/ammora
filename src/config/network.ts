import { defineChain } from 'viem'

const rpcUrl = import.meta.env.VITE_GIWA_RPC_URL || 'https://sepolia-rpc.giwa.io'
const explorerUrl = import.meta.env.VITE_GIWA_EXPLORER_URL || 'https://sepolia-explorer.giwa.io'
const dataApiUrl = import.meta.env.VITE_AMMORA_DATA_API || '/ammora-api'

export const GIWA_SEPOLIA = defineChain({
  id: 91342,
  name: 'GIWA Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
    public: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: 'GIWA Explorer', url: explorerUrl },
  },
  testnet: true,
})

export const NETWORK_CONFIG = {
  chainId: 91342,
  chainHex: '0x164ce',
  rpcUrl,
  explorerUrl,
  dataApiUrl,
}
