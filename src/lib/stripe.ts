import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

// Returns null when Stripe is not configured, so the site keeps working with bank transfers only.
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  client ??= new Stripe(key);
  return client;
}

export const toFils = (aed: number) => Math.round(Number(aed) * 100);
