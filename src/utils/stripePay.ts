// Web build: Stripe's native PaymentSheet is not available, so card top-ups are mobile-only.
export const cardPaymentsSupported = false;

export async function payWithPaymentSheet(_clientSecret: string, _publishableKey?: string | null): Promise<{ ok: boolean; message?: string }> {
  return { ok: false, message: 'Card top-ups are available in the iOS and Android app' };
}
