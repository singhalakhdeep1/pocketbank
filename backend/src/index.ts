import express from 'express';

const app = express();
const port = process.env.PORT || 4001;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok', app: 'PocketBank Mobile Backend API' });
});

app.post('/api/qr/pay', (req, res) => {
  const { merchantId, amount } = req.body;
  res.json({
    transactionId: `tx-qr-${Date.now()}`,
    status: 'SUCCESS',
    merchantId,
    amount,
  });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`PocketBank API listening on port ${port}`);
  });
}

export default app;
