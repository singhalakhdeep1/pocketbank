import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from '../config';

export const cardPaymentsSupported = true;

/** Collects card details with Stripe's PaymentSheet; resolves true when the payment succeeded. */
export async function payWithPaymentSheet(clientSecret: string, publishableKey?: string | null): Promise<{ ok: boolean; message?: string }> {
  const key = publishableKey || STRIPE_PUBLISHABLE_KEY;
  if (!key) return { ok: false, message: 'Stripe publishable key is not configured' };
  await initStripe({ publishableKey: key, merchantIdentifier: 'merchant.com.pocketbank.mobile' });
  const init = await initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: 'PocketBank' });
  if (init.error) return { ok: false, message: init.error.message };
  const result = await presentPaymentSheet();
  if (result.error) return { ok: false, message: result.error.message };
  return { ok: true };
}
