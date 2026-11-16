import { type FormEvent, type ReactNode, useDeferredValue, useState } from 'react'
import { Link, NavLink, Navigate, Route, Routes, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CheckCircle2, ExternalLink, Menu, RefreshCw, Wallet, X } from 'lucide-react'
import {
  AmmoraDataApiError,
  buildCreateAmmoraV4Launch,
  getAmmoraV4ConfigAtBlock,
  parseAmmoraV4LaunchCreatedReceipt,
  parseAmmoraV4MigratedReceipt,
  parseAmmoraV4SwapReceipt,
} from '@ammora-protocol/sdk'
import { erc20Abi, formatUnits, isAddress, parseUnits, type Address } from 'viem'
import { useAccount, useConnect, useDisconnect, usePublicClient, useSwitchChain, useWalletClient } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { GIWA_SEPOLIA, NETWORK_CONFIG } from './config/network'
import { getEnabledV4Configs, getLaunch, getLaunches, getV4CurveDetails, giwaV4, type LaunchSummary } from './services/ammora'

type TokenMetadata = { name?: string; symbol?: string; description?: string; image?: string }
type DisplayLaunch = LaunchSummary & { metadata: TokenMetadata }
type TradeSide = 'buy' | 'sell'

const navItems = [
  { label: 'Explore', to: '/explore' },
  { label: 'Create Token', to: '/create' },
  { label: 'My Tokens', to: '/my-tokens' },
  { label: 'About', to: '/about' },
]

function shortAddress(address?: string | null) {
  if (!address) return 'Not available'
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function ipfsUrl(uri: string) {
  if (uri.startsWith('ipfs://')) return `https://ipfs.io/ipfs/${uri.slice(7)}`
  if (uri.startsWith('ar://')) return `https://arweave.net/${uri.slice(5)}`
  return uri
}

async function fetchMetadata(uri: string): Promise<TokenMetadata> {
  if (!uri) return {}
  try {
    const response = await fetch(ipfsUrl(uri), { signal: AbortSignal.timeout(7000) })
    if (!response.ok) return {}
    const value = await response.json() as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : undefined,
      symbol: typeof value.symbol === 'string' ? value.symbol : undefined,
      description: typeof value.description === 'string' ? value.description : undefined,
      image: typeof value.image === 'string' ? ipfsUrl(value.image) : undefined,
    }
  } catch {
    return {}
  }
}

async function getDisplayLaunches(parameters: Omit<Parameters<typeof getLaunches>[0], 'signal'> = {}, signal?: AbortSignal): Promise<DisplayLaunch[]> {
  const page = await getLaunches({ ...parameters, signal })
  return Promise.all(page.items.slice(0, 30).map(async (launch) => ({
    ...launch,
    metadata: await fetchMetadata(launch.metadataUri),
  })))
}

function App() {
  return <div className="min-h-screen bg-slate-950 text-slate-100"><AppLayout /></div>
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  return <>
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-400 text-sm font-black text-slate-950">A</div>
          <div><div className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Ammora</div><div className="text-lg font-semibold text-white">LaunchPad</div></div>
        </Link>
        <nav className="hidden items-center gap-6 md:flex">{navItems.map((item) => <NavLink key={item.to} to={item.to} className={({ isActive }) => `text-sm font-medium transition ${isActive ? 'text-emerald-300' : 'text-slate-300 hover:text-white'}`}>{item.label}</NavLink>)}</nav>
        <div className="hidden items-center gap-3 md:flex"><NetworkBadge /><WalletButton /></div>
        <button type="button" className="inline-flex rounded-lg border border-slate-700 p-2 md:hidden" aria-label="Toggle navigation" onClick={() => setMobileOpen((open) => !open)}>{mobileOpen ? <X size={18} /> : <Menu size={18} />}</button>
      </div>
      {mobileOpen && <div className="border-t border-slate-800 bg-slate-950 md:hidden"><div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4">{navItems.map((item) => <NavLink key={item.to} to={item.to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-slate-800 text-emerald-300' : 'text-slate-300'}`}>{item.label}</NavLink>)}<div className="mt-2 flex items-center justify-between gap-3"><NetworkBadge compact /><WalletButton /></div></div></div>}
    </header>
    <main><Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/explore" element={<ExplorePage />} />
      <Route path="/create" element={<CreatePage />} />
      <Route path="/token/:address" element={<TokenDetailsPage />} />
      <Route path="/my-tokens" element={<MyTokensPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes></main>
  </>
}

function NetworkBadge({ compact = false }: { compact?: boolean }) {
  const { chainId, isConnected } = useAccount()
  const active = chainId === GIWA_SEPOLIA.id
  const label = active ? 'GIWA Sepolia' : isConnected ? 'Wrong network' : 'Wallet disconnected'
  return <div className={`flex items-center gap-2 rounded-full border ${active ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300' : isConnected ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-slate-700 bg-slate-900 text-slate-400'} ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}><span className={`h-2 w-2 rounded-full ${active ? 'bg-emerald-400' : isConnected ? 'bg-amber-400' : 'bg-slate-500'}`} /><span className="font-medium">{label}</span></div>
}

function WalletButton() {
  const { address, chainId, isConnected } = useAccount()
  const { connect, isPending: connecting } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  if (!isConnected) return <button type="button" className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 disabled:opacity-60" disabled={connecting} onClick={() => connect({ connector: injected() })}><Wallet size={16} />{connecting ? 'Connecting...' : 'Connect Wallet'}</button>
  return <div className="flex items-center gap-2">{chainId !== GIWA_SEPOLIA.id ? <button type="button" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-950" disabled={switching} onClick={() => switchChain({ chainId: GIWA_SEPOLIA.id })}>{switching ? 'Switching...' : 'Switch to GIWA'}</button> : <span className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200">{shortAddress(address)}</span>}<button type="button" aria-label="Disconnect wallet" title="Disconnect wallet" className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:text-white" onClick={() => disconnect()}>Disconnect</button></div>
}

function HomePage() {
  const launches = useQuery({ queryKey: ['launches', 'home'], queryFn: ({ signal }) => getDisplayLaunches({}, signal) })
  const items = launches.data ?? []
  const activeCount = items.filter((launch) => launch.status === 'ACTIVE').length
  const migrationCount = items.filter((launch) => launch.status === 'MIGRATION_READY').length
  return <>
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20"><div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]"><div><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200">GIWA Sepolia · Ammora V4</div><h1 className="max-w-2xl text-4xl font-black text-white sm:text-5xl lg:text-6xl">Launch tokens on a live market.</h1><p className="mt-6 max-w-xl text-lg text-slate-300">Explore Ammora launches, review live curve state, and create or trade with your connected wallet.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/explore" className="inline-flex items-center gap-2 rounded-lg bg-emerald-400 px-5 py-3 font-semibold text-slate-950 hover:bg-emerald-300">Explore launches <ArrowRight size={18} /></Link><Link to="/create" className="rounded-lg border border-slate-700 bg-slate-900 px-5 py-3 font-semibold text-white hover:border-slate-500">Create token</Link></div></div>
      <div className="border-l-2 border-emerald-400 py-2 pl-6 sm:pl-8"><div className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Indexer snapshot</div>{launches.isLoading ? <p className="mt-5 text-slate-300">Loading GIWA launches...</p> : launches.isError ? <ErrorMessage message={dataApiError(launches.error, 'Could not load launches.')} /> : <><dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5"><Stat label="Loaded launches" value={String(items.length)} /><Stat label="Active in page" value={String(activeCount)} /><Stat label="Ready in page" value={String(migrationCount)} /><Stat label="Network" value="GIWA Sepolia" /></dl><a className="mt-6 inline-flex items-center gap-1 text-sm text-emerald-300 hover:text-emerald-200" href={NETWORK_CONFIG.explorerUrl} target="_blank" rel="noreferrer">GIWA Explorer <ExternalLink size={14} /></a></>}</div>
    </div></section>
    <section className="border-y border-slate-800 bg-slate-900/50"><div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8"><div className="mb-7 flex items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">Latest</p><h2 className="mt-2 text-2xl font-bold text-white">On-chain launches</h2></div><Link to="/explore" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-300 hover:text-emerald-200">All launches <ArrowRight size={16} /></Link></div>{launches.isLoading ? <LoadingMessage /> : launches.isError ? <ErrorMessage message="Could not load launches from the Ammora Data API." /> : items.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.slice(0, 6).map((launch) => <TokenCard key={launch.id} launch={launch} />)}</div> : <EmptyMessage message="No GIWA launches are indexed yet." />}</div></section>
  </>
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 text-xl font-semibold text-white">{value}</dd></div>
}

function ExplorePage() {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('ALL')
  const queryClient = useQueryClient()
  const launches = useQuery({ queryKey: ['launches', 'explore'], queryFn: ({ signal }) => getDisplayLaunches({}, signal) })
  const normalized = query.trim().toLowerCase()
  const filtered = (launches.data ?? []).filter((launch) => {
    const statusMatch = filter === 'ALL' || launch.status === filter
    const content = `${launch.metadata.name ?? ''} ${launch.metadata.symbol ?? ''} ${launch.address} ${launch.curveAddress}`.toLowerCase()
    return statusMatch && (!normalized || content.includes(normalized))
  })
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><PageHeading eyebrow="Explore" title="GIWA token launches" action={<button type="button" title="Refresh launches" aria-label="Refresh launches" className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-slate-200 hover:text-emerald-300" onClick={() => void queryClient.invalidateQueries({ queryKey: ['launches', 'explore'] })}><RefreshCw size={18} /></button>} /><div className="mt-6 grid gap-3 md:grid-cols-[1fr_240px]"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, symbol, or address" className="input" /><select value={filter} onChange={(event) => setFilter(event.target.value)} className="input"><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="ACTIVE">Active</option><option value="MIGRATION_READY">Ready to migrate</option><option value="MIGRATED">Migrated</option><option value="FLAGGED">Flagged</option></select></div><div className="mt-7">{launches.isLoading ? <LoadingMessage /> : launches.isError ? <ErrorMessage message={dataApiError(launches.error, 'Could not load launches.')} /> : filtered.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filtered.map((launch) => <TokenCard key={launch.id} launch={launch} />)}</div> : <EmptyMessage message="No launches match this search and status." />}</div></div>
}

function CreatePage() {
  const { address, chainId, isConnected } = useAccount()
  const publicClient = usePublicClient({ chainId: GIWA_SEPOLIA.id })
  const { data: walletClient } = useWalletClient({ chainId: GIWA_SEPOLIA.id })
  const queryClient = useQueryClient()
  const configs = useQuery({ queryKey: ['ammora-configs'], queryFn: ({ signal }) => getEnabledV4Configs(signal), staleTime: 30_000 })
  const [selectedConfigId, setSelectedConfigId] = useState('')
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [metadataUri, setMetadataUri] = useState('')
  const [creatorMetadataUri, setCreatorMetadataUri] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [receiptHash, setReceiptHash] = useState<`0x${string}` | null>(null)
  const [createdToken, setCreatedToken] = useState<Address | null>(null)
  const selectedConfig = configs.data?.items.find((item) => item.configId === selectedConfigId)
  const configSnapshot = useQuery({
    queryKey: ['ammora-config-snapshot', selectedConfigId],
    enabled: Boolean(publicClient && selectedConfigId),
    queryFn: async () => {
      if (!publicClient || !selectedConfigId) throw new Error('RPC client unavailable')
      const block = await publicClient.getBlockNumber()
      return getAmmoraV4ConfigAtBlock(publicClient, giwaV4.contracts.launch.configRegistry, BigInt(selectedConfigId), block)
    },
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setReceiptHash(null)
    setCreatedToken(null)
    if (!isConnected || !address || !walletClient || !publicClient) return setError('Connect a wallet to prepare this launch.')
    if (chainId !== GIWA_SEPOLIA.id) return setError('Switch your wallet to GIWA Sepolia first.')
    if (!selectedConfig || !configSnapshot.data?.enabled) return setError('Select an enabled, confirmed Ammora Config.')
    if (!name.trim() || !/^[A-Za-z0-9]{2,12}$/.test(symbol.trim())) return setError('Enter a token name and a 2–12 character letters/numbers symbol.')
    if (!/^(https?:\/\/|ipfs:\/\/)/i.test(metadataUri.trim())) return setError('Metadata URI must start with https:// or ipfs://.')

    setBusy(true)
    try {
      const snapshot = configSnapshot.data
      if (snapshot.configHash.toLowerCase() !== selectedConfig.configHash.toLowerCase()) {
        throw new Error('The indexed Config hash is stale. Refresh Configs and review the current on-chain values.')
      }
      const built = buildCreateAmmoraV4Launch({
        name: name.trim(),
        symbol: symbol.trim().toUpperCase(),
        metadataURI: metadataUri.trim(),
        creatorMetadataURI: creatorMetadataUri.trim(),
        tokenDecimals: snapshot.config.tokenDecimals,
      }, BigInt(selectedConfig.configId), snapshot.config.poolCreationFee)
      await publicClient.call({ account: address, to: giwaV4.contracts.launch.factory, data: built.data, value: built.value })
      const hash = await walletClient.sendTransaction({ account: address, chain: GIWA_SEPOLIA, to: giwaV4.contracts.launch.factory, data: built.data, value: built.value })
      setReceiptHash(hash)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Launch transaction reverted. No token was created.')
      const parsed = parseAmmoraV4LaunchCreatedReceipt(receipt, giwaV4.contracts.launch.factory)
      setCreatedToken(parsed.token)
      await queryClient.invalidateQueries({ queryKey: ['launches'] })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Launch could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8"><PageHeading eyebrow="Create token" title="Issue on Ammora V4" /><div className="mt-7 grid gap-7 lg:grid-cols-[1fr_0.72fr]"><form onSubmit={submit} className="space-y-5 border-t border-slate-700 pt-6">
    <Field label="Enabled launch Config"><select className="input" value={selectedConfigId} onChange={(event) => setSelectedConfigId(event.target.value)} disabled={configs.isLoading || !configs.data?.items.length}><option value="">{configs.isLoading ? 'Loading enabled configs...' : 'Choose a Config'}</option>{configs.data?.items.map((config) => <option key={config.configId} value={config.configId}>Config {config.configId} · {shortAddress(config.ownerAddress)}</option>)}</select></Field>
    {configs.isError && <div><ErrorMessage message={dataApiError(configs.error, 'Enabled Configs could not be loaded.')} /><button type="button" className="mt-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200" onClick={() => void configs.refetch()}>Retry Config lookup</button></div>}
    {configs.data && !configs.data.items.length && <EmptyMessage message="No enabled V4 Configs are currently indexed for this deployment." />}
    {configSnapshot.data && <div className="grid gap-3 border-l-2 border-emerald-400 pl-4 text-sm sm:grid-cols-2"><Stat label="Token decimals" value={String(configSnapshot.data.config.tokenDecimals)} /><Stat label="Pool creation fee" value={`${formatUnits(configSnapshot.data.config.poolCreationFee, 18)} ETH`} /><Stat label="Config hash" value={shortAddress(configSnapshot.data.configHash)} /><Stat label="Confirmed block" value={configSnapshot.data.asOfBlock.toString()} /></div>}
    <Field label="Token name"><input className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={64} required placeholder="Example Token" /></Field>
    <Field label="Token symbol"><input className="input uppercase" value={symbol} onChange={(event) => setSymbol(event.target.value)} maxLength={12} required placeholder="EXM" /></Field>
    <Field label="Token metadata URI"><input className="input" value={metadataUri} onChange={(event) => setMetadataUri(event.target.value)} required placeholder="ipfs://... or https://..." /></Field>
    <Field label="Creator metadata URI (optional)"><input className="input" value={creatorMetadataUri} onChange={(event) => setCreatorMetadataUri(event.target.value)} placeholder="https://..." /></Field>
    {error && <ErrorMessage message={error} />}
    <button type="submit" disabled={busy || !isConnected || chainId !== GIWA_SEPOLIA.id || !configSnapshot.data?.enabled} className="w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{busy ? 'Waiting for confirmation...' : 'Review and create token'}</button>
    {receiptHash && <TransactionLink hash={receiptHash} label={busy ? 'Transaction submitted' : 'Creation transaction'} />}
    {createdToken && <div className="flex items-center justify-between gap-4 border-l-2 border-emerald-400 bg-emerald-500/10 p-4 text-sm"><span><CheckCircle2 className="mr-2 inline text-emerald-300" size={16} />Launch confirmed: {shortAddress(createdToken)}</span><Link className="font-semibold text-emerald-300" to={`/token/${createdToken}`}>Open</Link></div>}
  </form><aside className="space-y-4 border-t border-slate-700 pt-6 text-sm text-slate-300"><h2 className="text-lg font-semibold text-white">Launch review</h2><p>Creation uses the selected enabled Config’s live token decimals and pool creation fee. The SDK builds the call; the connected wallet simulates and signs it.</p><p>The metadata URI must already be hosted. This browser app does not upload files or manage an IPFS pinning key.</p><p className="text-amber-200">The transaction creates a token and curve. Verify the confirmed receipt before sharing the token address.</p><a href={`${NETWORK_CONFIG.explorerUrl}/address/${giwaV4.contracts.launch.factory}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-emerald-300 hover:text-emerald-200">Reviewed launch factory <ExternalLink size={14} /></a></aside></div></div>
}

function TokenDetailsPage() {
  const { address: routeAddress } = useParams()
  const publicClient = usePublicClient({ chainId: GIWA_SEPOLIA.id })
  const { address, chainId } = useAccount()
  const { data: walletClient } = useWalletClient({ chainId: GIWA_SEPOLIA.id })
  const queryClient = useQueryClient()
  const validAddress = Boolean(routeAddress && isAddress(routeAddress))
  const launchQuery = useQuery({ queryKey: ['launch', routeAddress], enabled: validAddress, queryFn: ({ signal }) => getLaunch(routeAddress as Address, signal) })
  const launch = launchQuery.data
  const stateQuery = useQuery({ queryKey: ['launch-state', launch?.id], enabled: Boolean(publicClient && launch?.protocolVersion === 4), queryFn: () => getV4CurveDetails(publicClient!, launch!), refetchInterval: 12_000 })
  const [side, setSide] = useState<TradeSide>('buy')
  const [amount, setAmount] = useState('')
  const [slippage, setSlippage] = useState('100')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null)
  const [txNote, setTxNote] = useState('')
  const deferredAmount = useDeferredValue(amount)
  const details = stateQuery.data
  const inputDecimals = side === 'buy' ? details?.quoteDecimals : details?.config.config.tokenDecimals
  const outputDecimals = side === 'buy' ? details?.config.config.tokenDecimals : details?.quoteDecimals
  const inputRaw = inputDecimals === undefined ? 0n : parseRaw(deferredAmount, inputDecimals)
  const quoteQuery = useQuery({ queryKey: ['curve-quote', launch?.id, side, deferredAmount, details?.asOfBlock], enabled: Boolean(details && details.state.status === 1 && inputRaw > 0n), queryFn: () => details!.curve.quoteExactInput(inputRaw, side === 'sell') })
  const metadataQuery = useQuery({ queryKey: ['token-metadata', launch?.metadataUri], enabled: Boolean(launch?.metadataUri), queryFn: () => fetchMetadata(launch!.metadataUri) })

  const executeTrade = async () => {
    setError('')
    setTxHash(null)
    if (!address || !walletClient || !publicClient) return setError('Connect a wallet before trading.')
    if (chainId !== GIWA_SEPOLIA.id) return setError('Switch your wallet to GIWA Sepolia before trading.')
    if (!details || !launch || launch.protocolVersion !== 4) return setError('This launch does not have a supported V4 trading route.')
    if (details.state.status !== 1) return setError('This curve is not active. Refresh its on-chain state before continuing.')
    const tradeAmount = inputDecimals === undefined ? 0n : parseRaw(amount, inputDecimals)
    const slippageBps = Number(slippage)
    if (tradeAmount <= 0n) return setError('Enter an amount greater than zero.')
    if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 1000) return setError('Slippage must be between 1 and 1000 basis points.')

    setBusy(true)
    try {
      const current = await getV4CurveDetails(publicClient, launch)
      if (current.state.status !== 1) throw new Error('Curve is no longer active. Refresh before trading.')
      let plan = await current.curve.planSwapExactInput({ includedAmountIn: tradeAmount, baseForQuote: side === 'sell', allowPartialFill: false, slippageBps, recipient: address, deadline: BigInt(Math.floor(Date.now() / 1000) + 1200) })
      const allowance = await publicClient.readContract({ address: plan.approvalRequirement.token, abi: erc20Abi, functionName: 'allowance', args: [address, plan.approvalRequirement.spender] })
      if (allowance < plan.approvalRequirement.amount) {
        if (plan.approvalRequirement.resetToZero && allowance > 0n) {
          setTxNote('Reset input-token allowance')
          const reset = await publicClient.simulateContract({ account: address, address: plan.approvalRequirement.token, abi: erc20Abi, functionName: 'approve', args: [plan.approvalRequirement.spender, 0n] })
          const resetHash = await walletClient.writeContract(reset.request)
          setTxHash(resetHash)
          const resetReceipt = await publicClient.waitForTransactionReceipt({ hash: resetHash })
          if (resetReceipt.status !== 'success') throw new Error('Allowance reset failed; the swap was not submitted.')
        }
        setTxNote('Approve input token')
        const approval = await publicClient.simulateContract({ account: address, address: plan.approvalRequirement.token, abi: erc20Abi, functionName: 'approve', args: [plan.approvalRequirement.spender, plan.approvalRequirement.amount] })
        const approvalHash = await walletClient.writeContract(approval.request)
        setTxHash(approvalHash)
        const approvalReceipt = await publicClient.waitForTransactionReceipt({ hash: approvalHash })
        if (approvalReceipt.status !== 'success') throw new Error('Token approval failed; the swap was not submitted.')
        setTxNote('Approval confirmed; prepare swap')
        const refreshed = await getV4CurveDetails(publicClient, launch)
        if (refreshed.state.status !== 1) throw new Error('Curve state changed during approval. Review the refreshed launch before swapping.')
        plan = await refreshed.curve.planSwapExactInput({ includedAmountIn: tradeAmount, baseForQuote: side === 'sell', allowPartialFill: false, slippageBps, recipient: address, deadline: BigInt(Math.floor(Date.now() / 1000) + 1200) })
      }
      setTxNote('Swap submitted')
      await publicClient.call({ account: address, to: plan.transaction.to, data: plan.transaction.data, value: plan.transaction.value ?? 0n })
      const hash = await walletClient.sendTransaction({ account: address, chain: GIWA_SEPOLIA, to: plan.transaction.to, data: plan.transaction.data, value: plan.transaction.value ?? 0n })
      setTxHash(hash)
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Swap reverted. No successful trade was recorded.')
      const parsed = parseAmmoraV4SwapReceipt(receipt, launch.curveAddress, { trader: address, recipient: address, baseForQuote: side === 'sell', requestedAmountIn: tradeAmount, minimumAmountOut: plan.quote.minimumAmountOut })
      setTxNote(`Trade confirmed · received ${formatUnits(parsed.amountOut, outputDecimals ?? 18)}`)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['launch-state', launch.id] }), queryClient.invalidateQueries({ queryKey: ['launch', routeAddress] }), queryClient.invalidateQueries({ queryKey: ['launches'] })])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Trade failed.')
    } finally {
      setBusy(false)
    }
  }

  const executeMigration = async () => {
    setError('')
    setTxHash(null)
    if (!address || !walletClient || !publicClient) return setError('Connect a wallet before migrating.')
    if (chainId !== GIWA_SEPOLIA.id) return setError('Switch your wallet to GIWA Sepolia before migrating.')
    if (!launch || !details || details.state.status !== 2) return setError('Migration is only available after the curve reaches ReadyToMigrate.')
    setBusy(true)
    try {
      const current = await getV4CurveDetails(publicClient, launch)
      if (current.state.status !== 2) throw new Error('The curve is no longer ReadyToMigrate.')
      const plan = await current.curve.planMigrate()
      await publicClient.call({ account: address, to: plan.transaction.to, data: plan.transaction.data, value: plan.transaction.value ?? 0n })
      const hash = await walletClient.sendTransaction({ account: address, chain: GIWA_SEPOLIA, to: plan.transaction.to, data: plan.transaction.data, value: plan.transaction.value ?? 0n })
      setTxHash(hash)
      setTxNote('Migration submitted')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') throw new Error('Migration reverted. The curve remains unmigrated.')
      const result = parseAmmoraV4MigratedReceipt(receipt, launch.curveAddress)
      setTxNote(`Migration confirmed · pool ${shortAddress(result.canonicalPool)}`)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['launch-state', launch.id] }), queryClient.invalidateQueries({ queryKey: ['launch', routeAddress] }), queryClient.invalidateQueries({ queryKey: ['launches'] })])
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Migration failed.')
    } finally {
      setBusy(false)
    }
  }

  if (!validAddress) return <NotFoundPage />
  if (launchQuery.isLoading) return <div className="mx-auto max-w-7xl px-4 py-10"><LoadingMessage /></div>
  if (launchQuery.isError || !launch) return <div className="mx-auto max-w-7xl px-4 py-10"><ErrorMessage message="This launch was not found in the Ammora indexer." /></div>
  const title = metadataQuery.data?.name || `Launch ${shortAddress(launch.address)}`
  const statusLabel = details ? curveStatus(details.state.status) : launch.status.replaceAll('_', ' ')
  const canWrite = Boolean(address && chainId === GIWA_SEPOLIA.id && launch.protocolVersion === 4)

  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="mb-7 flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-6"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">Token details</p><h1 className="mt-2 text-3xl font-bold text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{metadataQuery.data?.symbol || 'Token'} · {shortAddress(launch.address)}</p></div><StatusPill label={statusLabel} /></div>
    {metadataQuery.data?.description && <p className="mb-6 max-w-3xl text-slate-300">{metadataQuery.data.description}</p>}
    {launch.protocolVersion !== 4 && <ErrorMessage message={`Protocol V${launch.protocolVersion} is available for discovery only. This app only enables transactions for the reviewed V4 generation.`} />}
    {stateQuery.isError && <ErrorMessage message="On-chain curve state is unavailable. Trading and migration are disabled until reads succeed." />}
    <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]"><section className="space-y-6"><div className="grid gap-4 sm:grid-cols-2"><DataPoint label="Creator" value={shortAddress(launch.creatorAddress)} /><DataPoint label="Config ID" value={launch.configId} /><DataPoint label="Curve" value={shortAddress(launch.curveAddress)} /><DataPoint label="Created block" value={launch.createdBlock} />{details && <><DataPoint label="Base reserve" value={`${formatUnits(details.state.baseReserve, details.config.config.tokenDecimals)} ${metadataQuery.data?.symbol || 'tokens'}`} /><DataPoint label="Quote reserve" value={`${formatUnits(details.state.quoteReserve, details.quoteDecimals)} ${details.quoteSymbol}`} /><DataPoint label="Current fee" value={`${details.state.currentFeeBps} bps`} /><DataPoint label="Migration progress" value={`${calculateProgress(details.state.baseReserve, details.state.quoteReserve, details.state.migrationBaseThreshold, details.state.migrationQuoteThreshold)}%`} /></>}</div>
      {details?.state.status === 3 && details.state.canonicalPool !== '0x0000000000000000000000000000000000000000' && <a className="inline-flex items-center gap-2 text-emerald-300" href={`${NETWORK_CONFIG.explorerUrl}/address/${details.state.canonicalPool}`} target="_blank" rel="noreferrer">Graduated pool {shortAddress(details.state.canonicalPool)} <ExternalLink size={14} /></a>}
      {launch.recentTrades.length > 0 && <div className="border-t border-slate-800 pt-5"><h2 className="mb-3 text-lg font-semibold text-white">Recent indexed trades</h2><div className="space-y-2">{launch.recentTrades.slice(0, 6).map((trade) => <div key={`${trade.transactionHash}-${trade.logIndex}`} className="flex flex-wrap justify-between gap-2 text-sm text-slate-300"><span>{trade.isBuy ? 'Buy' : 'Sell'} · {shortAddress(trade.traderAddress)}</span><a className="text-emerald-300" href={`${NETWORK_CONFIG.explorerUrl}/tx/${trade.transactionHash}`} target="_blank" rel="noreferrer">{shortAddress(trade.transactionHash)}</a></div>)}</div></div>}
    </section>
    <aside className="space-y-6"><div className="border-t border-slate-700 pt-5"><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-lg font-semibold text-white">Trade on curve</h2><div className="flex border border-slate-700 p-1">{(['buy', 'sell'] as const).map((value) => <button key={value} type="button" className={`rounded px-3 py-1.5 text-sm font-medium capitalize ${side === value ? 'bg-emerald-400 text-slate-950' : 'text-slate-300'}`} onClick={() => { setSide(value); setAmount('') }}>{value}</button>)}</div></div>
      <label className="block"><span className="mb-2 block text-sm text-slate-300">{side === 'buy' ? `Spend ${details?.quoteSymbol ?? 'quote token'}` : `Sell ${metadataQuery.data?.symbol || 'token'}`}</span><input inputMode="decimal" className="input" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.0" /></label>
      <div className="mt-4 space-y-3 border-y border-slate-800 py-4 text-sm text-slate-300"><div className="flex justify-between gap-4"><span>Estimated output</span><strong className="text-white">{quoteQuery.data && outputDecimals !== undefined ? `${formatUnits(quoteQuery.data.amountOut, outputDecimals)} ${side === 'buy' ? metadataQuery.data?.symbol || 'token' : details?.quoteSymbol}` : '—'}</strong></div><div className="flex items-center justify-between gap-4"><label htmlFor="slippage">Slippage (bps)</label><input id="slippage" className="w-24 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-right text-white" type="number" min="1" max="1000" value={slippage} onChange={(event) => setSlippage(event.target.value)} /></div>{quoteQuery.isError && <p className="text-amber-200">Quote unavailable for this amount or curve state.</p>}</div>
      {error && <div className="mt-4"><ErrorMessage message={error} /></div>}
      <button type="button" className="mt-4 w-full rounded-lg bg-emerald-400 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={!canWrite || !details || details.state.status !== 1 || busy || inputRaw <= 0n} onClick={() => void executeTrade()}>{busy ? 'Confirming transaction...' : side === 'buy' ? 'Buy tokens' : 'Sell tokens'}</button>
      {txHash && <div className="mt-3"><TransactionLink hash={txHash} label={txNote || 'Transaction'} /></div>}
      {details?.state.status === 2 && <button type="button" className="mt-3 w-full rounded-lg border border-amber-400/50 px-4 py-3 font-semibold text-amber-200 hover:bg-amber-400/10 disabled:opacity-50" disabled={!canWrite || busy} onClick={() => void executeMigration()}>Migrate to graduated pool</button>}
      {!address && <p className="mt-3 text-xs text-slate-400">Connect a wallet to trade. Quotes are read-only and do not require a wallet.</p>}{address && chainId !== GIWA_SEPOLIA.id && <p className="mt-3 text-xs text-amber-200">Switch to GIWA Sepolia before trading.</p>}
    </div><div className="border-t border-slate-800 pt-4 text-sm text-slate-400"><div className="flex justify-between gap-3"><span>Token address</span><a className="text-emerald-300" href={`${NETWORK_CONFIG.explorerUrl}/address/${launch.address}`} target="_blank" rel="noreferrer">{shortAddress(launch.address)} <ExternalLink className="inline" size={12} /></a></div><div className="mt-2 flex justify-between gap-3"><span>Explorer</span><a className="text-emerald-300" href={NETWORK_CONFIG.explorerUrl} target="_blank" rel="noreferrer">GIWA Explorer</a></div></div></aside></div>
  </div>
}

function MyTokensPage() {
  const { address, isConnected } = useAccount()
  const launches = useQuery({ queryKey: ['launches', 'wallet', address], enabled: Boolean(address), queryFn: ({ signal }) => getDisplayLaunches({ creator: address }, signal) })
  if (!isConnected || !address) return <ConnectPrompt title="Connect your wallet to see launches created by your address." />
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"><PageHeading eyebrow="My tokens" title={`Created by ${shortAddress(address)}`} /><div className="mt-7">{launches.isLoading ? <LoadingMessage /> : launches.isError ? <ErrorMessage message="Your launch history could not be loaded." /> : launches.data?.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{launches.data.map((launch) => <TokenCard key={launch.id} launch={launch} />)}</div> : <EmptyMessage message="No launches were found for this wallet." />}</div></div>
}

function AboutPage() {
  return <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8"><PageHeading eyebrow="Protocol" title="Ammora launch lifecycle" /><ol className="mt-8 space-y-6 border-l border-slate-700 pl-6 text-slate-300"><li><h2 className="font-semibold text-white">1. Choose an enabled Config</h2><p className="mt-1">The launch form reads the live V4 Config and uses its token decimals and pool creation fee.</p></li><li><h2 className="font-semibold text-white">2. Create the token and curve</h2><p className="mt-1">The SDK builds the call. The connected wallet simulates, signs, and waits for the canonical creation receipt.</p></li><li><h2 className="font-semibold text-white">3. Trade the active curve</h2><p className="mt-1">Quotes and swap calldata come from the authenticated V4 curve client. ERC-20 approvals and swaps require explicit wallet confirmation.</p></li><li><h2 className="font-semibold text-white">4. Migrate after graduation</h2><p className="mt-1">A ReadyToMigrate curve requires its own separate migration transaction; migration is never inferred from a quote.</p></li></ol><p className="mt-8 text-sm text-slate-400">This app targets the reviewed GIWA Sepolia auto-route V4 deployment. Legacy launches remain discoverable but their transactions are disabled.</p></div>
}

function TokenCard({ launch }: { launch: DisplayLaunch }) {
  const name = launch.metadata.name || `Launch ${shortAddress(launch.address)}`
  const symbol = launch.metadata.symbol || 'GIWA'
  return <article className="border-t-2 border-slate-700 bg-slate-900/60 p-5 transition hover:border-emerald-400"><div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3">{launch.metadata.image ? <img src={launch.metadata.image} alt="" loading="lazy" className="h-11 w-11 rounded-lg object-cover" /> : <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-400/15 font-bold text-emerald-200">{symbol.slice(0, 1)}</div>}<div className="min-w-0"><h3 className="truncate text-lg font-semibold text-white">{name}</h3><p className="mt-1 text-sm text-emerald-300">{symbol} · V{launch.protocolVersion}</p></div></div><StatusPill label={launch.status.replaceAll('_', ' ')} /></div><p className="mt-5 break-all text-xs text-slate-400">{launch.address}</p><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-slate-500">Creator</div><div className="mt-1 text-slate-200">{shortAddress(launch.creatorAddress)}</div></div><div><div className="text-xs text-slate-500">Created block</div><div className="mt-1 text-slate-200">{launch.createdBlock}</div></div></div><Link to={`/token/${launch.address}`} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200">View launch <ArrowRight size={16} /></Link></article>
}

function PageHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="flex items-end justify-between gap-4 border-b border-slate-800 pb-5"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">{eyebrow}</p><h1 className="mt-2 text-3xl font-bold text-white">{title}</h1></div>{action}</div>
}

function DataPoint({ label, value }: { label: string; value: string }) {
  return <div className="border-t border-slate-800 py-3"><div className="text-xs uppercase tracking-[0.12em] text-slate-500">{label}</div><div className="mt-1 break-all text-sm font-medium text-slate-100">{value}</div></div>
}

function StatusPill({ label }: { label: string }) {
  const positive = ['ACTIVE', 'MIGRATION READY', 'MIGRATED'].includes(label.toUpperCase())
  return <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium ${positive ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200' : 'border-slate-700 bg-slate-950 text-slate-300'}`}>{label}</span>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>{children}</label>
}

function LoadingMessage() {
  return <div className="flex items-center gap-3 py-8 text-sm text-slate-300"><RefreshCw className="animate-spin text-emerald-300" size={16} /> Loading Ammora data...</div>
}

function ErrorMessage({ message }: { message: string }) {
  return <div role="alert" className="border-l-2 border-rose-400 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{message}</div>
}

function dataApiError(error: unknown, context: string) {
  if (error instanceof AmmoraDataApiError) return `${context} The Ammora Data API returned HTTP ${error.status}.`
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return `${context} The Ammora Data API request timed out or was cancelled.`
  return `${context} ${error instanceof Error ? error.message : 'Unknown Data API error.'}`
}

function EmptyMessage({ message }: { message: string }) {
  return <div className="border border-dashed border-slate-700 px-5 py-8 text-center text-sm text-slate-400">{message}</div>
}

function ConnectPrompt({ title }: { title: string }) {
  return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><Wallet className="mx-auto text-emerald-300" size={28} /><h1 className="mt-4 text-2xl font-bold text-white">{title}</h1></div>
}

function TransactionLink({ hash, label }: { hash: `0x${string}`; label: string }) {
  return <a className="inline-flex items-center gap-2 break-all text-sm text-emerald-300 hover:text-emerald-200" href={`${NETWORK_CONFIG.explorerUrl}/tx/${hash}`} target="_blank" rel="noreferrer">{label}: {shortAddress(hash)} <ExternalLink size={14} /></a>
}

function NotFoundPage() {
  return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">404</p><h1 className="mt-3 text-4xl font-bold text-white">Launch not found</h1><p className="mt-4 text-slate-300">The requested route or token address is invalid.</p><Link to="/explore" className="mt-8 inline-flex items-center gap-2 text-emerald-300">Browse launches <ArrowRight size={16} /></Link></div>
}

function parseRaw(value: string, decimals: number) {
  if (!value.trim() || !/^\d*(\.\d*)?$/.test(value.trim())) return 0n
  try { return parseUnits(value.trim(), decimals) } catch { return 0n }
}

function curveStatus(status: number) {
  return ['Uninitialized', 'Active', 'Ready to migrate', 'Migrated'][status] ?? `Unknown (${status})`
}

function calculateProgress(base: bigint, quote: bigint, baseTarget: bigint, quoteTarget: bigint) {
  const baseBps = baseTarget > 0n ? Number(base * 10_000n / baseTarget) : 0
  const quoteBps = quoteTarget > 0n ? Number(quote * 10_000n / quoteTarget) : 0
  return Math.min(100, Math.max(0, Math.max(baseBps, quoteBps) / 100)).toFixed(1)
}

export default App