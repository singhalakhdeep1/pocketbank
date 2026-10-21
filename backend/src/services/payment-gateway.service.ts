/**
 * Stripe card top-ups. The app creates a PaymentIntent, confirms it with the Stripe SDK on the
 * device, and the money is credited when the intent succeeds (confirm endpoint or webhook).
 * STRIPE_API_BASE lets the API talk to stripe-mock in development.
 */
import Stripe from 'stripe';
import { config } from '../config.js';
import { unavailable } from '../lib/errors.js';

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!config.stripeSecretKey) throw unavailable('Card top-ups are not configured (STRIPE_SECRET_KEY)');
  if (!client) {
    const options: Stripe.StripeConfig = {};
    if (config.stripeApiBase) {
      const url = new URL(config.stripeApiBase);
      options.host = url.hostname;
      options.port = Number(url.port || (url.protocol === 'https:' ? 443 : 80));
      options.protocol = url.protocol.replace(':', '') as 'http' | 'https';
    }
    client = new Stripe(config.stripeSecretKey, options);
  }
  return client;
}

export const stripeEnabled = () => Boolean(config.stripeSecretKey);
