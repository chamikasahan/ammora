import {
  AmmoraDataApiClient,
  AmmoraV4LaunchCurveClient,
  getAmmoraV4ConfigAtBlock,
  giwaSepoliaAutoRouteDeployment,
  type AmmoraLaunch,
  type AmmoraLaunchSummary,
  type AmmoraV4IndexedConfig,
} from '@ammora-protocol/sdk'
import { erc20Abi, type Address, type PublicClient } from 'viem'
import { NETWORK_CONFIG } from '../config/network'

const dataApiUrl = new URL(NETWORK_CONFIG.dataApiUrl, window.location.origin).toString()

export const ammoraData = new AmmoraDataApiClient(dataApiUrl)
export const giwaV4 = giwaSepoliaAutoRouteDeployment

export type LaunchSummary = AmmoraLaunchSummary
export type IndexedConfig = AmmoraV4IndexedConfig

function apiSignal(signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(8_000)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

export function getLaunches(parameters: {
  creator?: Address
  status?: AmmoraLaunchSummary['status']
  query?: string
  signal?: AbortSignal
} = {}) {
  return ammoraData.getLaunches({ chainId: BigInt(NETWORK_CONFIG.chainId), ...parameters, signal: apiSignal(parameters.signal) })
}

export async function getLaunch(address: Address, signal?: AbortSignal): Promise<AmmoraLaunch> {
  return ammoraData.getLaunch(BigInt(NETWORK_CONFIG.chainId), address, apiSignal(signal))
}

export async function getEnabledV4Configs(signal?: AbortSignal) {
  return ammoraData.getAmmV4Configs({
    chainId: BigInt(NETWORK_CONFIG.chainId),
    registry: giwaV4.contracts.launch.configRegistry,
    enabled: true,
    signal: apiSignal(signal),
  })
}

export async function getV4CurveDetails(client: PublicClient, launch: AmmoraLaunchSummary) {
  if (launch.protocolVersion !== 4) {
    throw new Error(`Protocol version ${launch.protocolVersion} is read-only in this app.`)
  }

  const asOfBlock = await client.getBlockNumber()
  const curve = new AmmoraV4LaunchCurveClient(client, launch.curveAddress, {
    launchFactory: giwaV4.contracts.launch.factory,
    feePolicy: giwaV4.contracts.launch.feePolicy,
  })
  const [state, config] = await Promise.all([
    curve.getStateAtBlock(asOfBlock),
    getAmmoraV4ConfigAtBlock(
      client,
      giwaV4.contracts.launch.configRegistry,
      BigInt(launch.configId),
      asOfBlock,
    ),
  ])

  const [quoteDecimals, quoteSymbol] = await Promise.all([
    client.readContract({ address: state.quoteToken, abi: erc20Abi, functionName: 'decimals' }),
    client.readContract({ address: state.quoteToken, abi: erc20Abi, functionName: 'symbol' }),
  ])

  return { curve, state, config, asOfBlock, quoteDecimals, quoteSymbol }
}
