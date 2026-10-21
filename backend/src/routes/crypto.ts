import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { forbidden, notFound } from '../lib/errors.js';
import { logger, prisma } from '../lib/infra.js';
import { userId } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { body } from '../middleware/validate.js';
import { balance, broadcast, decodeSigned, normalizeAddress, receipt, txParams } from '../services/crypto.service.js';
import { INSTRUMENTS, quotes } from '../services/market-data.service.js';
import { notify } from '../services/notification.service.js';
import { param } from './helpers.js';

export const cryptoRouter = Router();

async function ownedWallet(uid: string, id: string) {
  const wallet = await prisma.cryptoWallet.findFirst({ where: { id, userId: uid } });
  if (!wallet) throw notFound('Wallet');
  return wallet;
}

cryptoRouter.get('/crypto/prices', async (req, res) => {
  const { symbols } = z.object({ symbols: z.string().optional() }).parse(req.query);
  const list = symbols ? symbols.split(',').slice(0, 20) : INSTRUMENTS.filter((i) => i.assetType === 'CRYPTO').map((i) => i.symbol);
  res.json(await quotes(list));
});

cryptoRouter.get('/crypto/status', (_req, res) => {
  res.json({ onChainEnabled: Boolean(config.ethereumRpcUrl), chain: 'ethereum' });
});

cryptoRouter.get('/crypto/wallets', async (req, res) => {
  res.json(await prisma.cryptoWallet.findMany({ where: { userId: userId(req) }, orderBy: { createdAt: 'asc' } }));
});

cryptoRouter.post('/crypto/wallets', async (req, res) => {
  const input = body(req, z.object({ address: z.string(), label: z.string().trim().max(30).default('My wallet') }));
  const uid = userId(req);
  const wallet = await prisma.cryptoWallet.create({ data: { userId: uid, address: normalizeAddress(input.address), label: input.label } });
  logger.logAuditEvent('CryptoWalletLinked', 'Self-custody wallet address linked', { userId: uid, address: wallet.address });
  res.status(201).json(wallet);
});

cryptoRouter.delete('/crypto/wallets/:id', async (req, res) => {
  const wallet = await ownedWallet(userId(req), param(req.params.id));
  await prisma.cryptoWallet.delete({ where: { id: wallet.id } });
  res.status(204).end();
});

cryptoRouter.get('/crypto/wallets/:id/balance', async (req, res) => {
  const wallet = await ownedWallet(userId(req), param(req.params.id));
  const [b, [eth]] = await Promise.all([balance(wallet.address), quotes(['ETH'])]);
  res.json({ address: wallet.address, ...b, usd: Number((b.eth * eth.price).toFixed(2)), ethPrice: eth.price });
});

cryptoRouter.get('/crypto/wallets/:id/tx-params', async (req, res) => {
  const { to, value } = z.object({ to: z.string(), value: z.string().regex(/^\d+(\.\d{1,18})?$/) }).parse(req.query);
  const wallet = await ownedWallet(userId(req), param(req.params.id));
  res.json(await txParams(wallet.address, normalizeAddress(to), value));
});

cryptoRouter.post('/crypto/wallets/:id/broadcast', rateLimit('broadcast', { capacity: 10, refillPerSecond: 0.1 }), async (req, res) => {
  const { signedTx } = body(req, z.object({ signedTx: z.string().regex(/^0x[0-9a-fA-F]+$/) }));
  const uid = userId(req);
  const wallet = await ownedWallet(uid, param(req.params.id));
  const decoded = decodeSigned(signedTx);
  if (decoded.from !== wallet.address) throw forbidden('Transaction was not signed by this wallet');
  const hash = await broadcast(signedTx);
  const record = await prisma.cryptoTx.create({ data: { walletId: wallet.id, hash, toAddress: decoded.to, valueWei: decoded.value } });
  logger.logAuditEvent('CryptoSent', 'On-chain transaction broadcast', { userId: uid, hash, to: decoded.to });
  void notify(uid, 'transaction', 'Crypto transfer sent', `Transaction ${hash.slice(0, 10)}… is pending`);
  res.status(201).json(record);
});

cryptoRouter.get('/crypto/wallets/:id/transactions', async (req, res) => {
  const wallet = await ownedWallet(userId(req), param(req.params.id));
  const txs = await prisma.cryptoTx.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  // Refresh pending ones from the chain.
  const refreshed = await Promise.all(
    txs.map(async (t) => {
      if (t.status !== 'pending' || !config.ethereumRpcUrl) return t;
      const r = await receipt(t.hash).catch(() => null);
      return r ? prisma.cryptoTx.update({ where: { id: t.id }, data: { status: r.status, blockNumber: r.blockNumber } }) : t;
    }),
  );
  res.json(refreshed);
});
