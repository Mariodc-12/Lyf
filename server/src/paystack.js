import crypto from 'node:crypto';

const BASE = process.env.PAYSTACK_API_URL || 'https://api.paystack.co';

export async function initializeTransaction({ email, amountNaira, reference, metadata, callbackUrl }) {
  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      amount: amountNaira * 100, // Paystack expects kobo
      reference,
      metadata,
      callback_url: callbackUrl,
      currency: 'NGN',
    }),
  });
  const data = await res.json();
  if (!res.ok || !data.status) throw new Error(data.message || 'Paystack initialization failed');
  return data.data; // { authorization_url, access_code, reference }
}

export function isValidWebhook(rawBody, signature) {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');
  return hash === signature;
}
