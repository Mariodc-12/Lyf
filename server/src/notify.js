// TODO: send a real SMS through Termii or Africa's Talking. Logged for local dev only.
export async function notify(phone, message) {
  if (!phone) return;
  console.log(`[SMS to ${phone}] ${message}`);
}
