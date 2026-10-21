/**
 * Self-custody Ethereum wallet support. Keys never leave the device: the app signs transactions
 * locally (ethers + SecureStore behind biometrics) and the API only reads chain state and relays
 * the signed transaction to ETHEREUM_RPC_URL.
 */
import { JsonRpcProvider, Transaction as EthTx, formatEther, getAddress, isAddress, parseEther } from 'ethers';
import { config } from '../config.js';
import { badRequest, unavailable } from '../lib/errors.js';

let provider: JsonRpcProvider | null = null;

export function rpc(): JsonRpcProvider {
  if (!config.ethereumRpcUrl) throw unavailable('Ethereum RPC is not configured (ETHEREUM_RPC_URL)');
  provider ??= new JsonRpcProvider(config.ethereumRpcUrl, undefined, { staticNetwork: true });
  return provider;
}

export function normalizeAddress(address: string): string {
  if (!isAddress(address)) throw badRequest('Invalid Ethereum address');
  return getAddress(address);
}

export async function balance(address: string) {
  const wei = await rpc().getBalance(address);
  return { wei: wei.toString(), eth: Number(formatEther(wei)) };
}

export async function txParams(from: string, to: string, valueEth: string) {
  const p = rpc();
  const value = parseEther(valueEth);
  const [nonce, network, fee, gasLimit] = await Promise.all([
    p.getTransactionCount(from, 'pending'),
    p.getNetwork(),
    p.getFeeData(),
    p.estimateGas({ from, to, value }),
  ]);
  return {
    chainId: Number(network.chainId),
    nonce,
    gasLimit: gasLimit.toString(),
    maxFeePerGas: (fee.maxFeePerGas ?? fee.gasPrice ?? 0n).toString(),
    maxPriorityFeePerGas: (fee.maxPriorityFeePerGas ?? 0n).toString(),
    value: value.toString(),
    estimatedFeeEth: Number(formatEther(gasLimit * (fee.maxFeePerGas ?? fee.gasPrice ?? 0n))),
  };
}

/** Decodes a signed raw transaction so the API can check who signed it before relaying. */
export function decodeSigned(raw: string) {
  try {
    const tx = EthTx.from(raw);
    if (!tx.from || !tx.to) throw new Error('missing from/to');
    return { from: getAddress(tx.from), to: getAddress(tx.to), value: tx.value.toString() };
  } catch {
    throw badRequest('Invalid signed transaction');
  }
}

export async function broadcast(raw: string) {
  const response = await rpc().broadcastTransaction(raw);
  return response.hash;
}

export async function receipt(hash: string) {
  const r = await rpc().getTransactionReceipt(hash);
  if (!r) return null;
  return { status: r.status === 1 ? 'confirmed' : 'failed', blockNumber: r.blockNumber };
}
