import { query } from './db.js';

// Email through Resend (https://resend.com). Without RESEND_API_KEY, emails are printed in the server
// terminal instead, so local development works with nothing to set up.
const appUrl = () => String(process.env.APP_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '');
const from = () => process.env.MAIL_FROM || 'Lyf <onboarding@resend.dev>';
const apiUrl = () => process.env.RESEND_API_URL || 'https://api.resend.com/emails';

export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const naira = (n) => `₦${Number(n || 0).toLocaleString('en-NG')}`;

function layout({ title, paragraphs, button, footer }) {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:#1B2250">${p}</p>`).join('');
  const cta = button
    ? `<p style="margin:22px 0 6px"><a href="${esc(button.url)}" style="background:#F2B134;color:#1B2250;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:999px;display:inline-block">${esc(button.label)}</a></p>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#F4F5FB;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:520px;margin:0 auto;padding:24px 16px">
<div style="background:#1B2250;border-radius:20px 20px 0 0;padding:22px 26px"><span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px">Lyf</span></div>
<div style="background:#fff;border-radius:0 0 20px 20px;padding:26px">
<h1 style="margin:0 0 16px;font-size:22px;color:#1B2250">${esc(title)}</h1>${body}${cta}
<p style="margin:26px 0 0;font-size:13px;color:#6b7094">${footer || 'You get this email because you have a Lyf account.'}</p>
</div></div></body></html>`;
}

function plain({ title, paragraphs, button }) {
  const strip = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [title, '', ...paragraphs.map(strip), ...(button ? ['', `${button.label}: ${button.url}`] : [])].join('\n');
}

// Never throws: a mail problem must not break a booking or payment.
export async function sendMail({ to, subject, kind, ...content }) {
  if (!to) return false;
  const html = layout({ title: subject, ...content });
  const text = plain({ title: subject, ...content });
  let status = 'sent';
  let error = null;
  try {
    if (!process.env.RESEND_API_KEY) {
      status = 'logged';
      console.log(`[EMAIL to ${to}] ${subject}\n${text}\n`);
    } else {
      const res = await fetch(apiUrl(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: from(), to: [to], subject, html, text }),
      });
      if (!res.ok) {
        status = 'failed';
        error = `Resend ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`;
        console.error('Email failed:', error);
      }
    }
  } catch (e) {
    status = 'failed';
    error = e.message;
    console.error('Email failed:', error);
  }
  try {
    await query(`INSERT INTO email_log (to_email, subject, kind, status, error) VALUES ($1,$2,$3,$4,$5)`, [to, subject, kind || null, status, error]);
  } catch (e) {
    console.error('Could not log email:', e.message);
  }
  return status !== 'failed';
}

const first = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';

export const mails = {
  welcome: (u) =>
    sendMail({
      to: u.email, kind: 'welcome', subject: 'Welcome to Lyf',
      paragraphs: [
        `Hi ${esc(first(u.name))}, your Lyf account is ready.`,
        u.role === 'vendor'
          ? 'Set up your business and add photos of your past work. Planners choose vendors they can see.'
          : 'Create your first event, split your budget across every cost, and book vendors in one place.',
      ],
      button: { label: u.role === 'vendor' ? 'Set up your business' : 'Plan an event', url: `${appUrl()}/` },
    }),

  loginCode: ({ email, name, code }) =>
    sendMail({
      to: email, kind: 'login_code', subject: `${code} is your Lyf sign-in code`,
      paragraphs: [
        `Hi ${esc(first(name))}, use this code to sign in to Lyf:`,
        `<span style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:8px;color:#1B2250;background:#F4F5FB;border-radius:12px;padding:12px 18px">${esc(code)}</span>`,
        'It works for 10 minutes and only once. If you did not ask for it, ignore this email.',
      ],
    }),

  passwordReset: (u, token) =>
    sendMail({
      to: u.email, kind: 'password_reset', subject: 'Reset your Lyf password',
      paragraphs: [
        `Hi ${esc(first(u.name))}, we got a request to reset your password.`,
        'This link works for 60 minutes. If you did not ask for it, ignore this email and your password stays the same.',
      ],
      button: { label: 'Choose a new password', url: `${appUrl()}/reset-password?token=${token}` },
    }),

  passwordChanged: (u) =>
    sendMail({
      to: u.email, kind: 'password_changed', subject: 'Your Lyf password was changed',
      paragraphs: [`Hi ${esc(first(u.name))}, your password was just changed.`, 'If this was not you, reset it now and contact Lyf support.'],
      button: { label: 'Reset password', url: `${appUrl()}/forgot-password` },
    }),

  newRequest: ({ vendorEmail, vendorName, eventTitle, plannerName }) =>
    sendMail({
      to: vendorEmail, kind: 'booking_request', subject: 'New booking request on Lyf',
      paragraphs: [
        `${esc(plannerName || 'A planner')} wants to book ${esc(vendorName)} for <strong>${esc(eventTitle)}</strong>.`,
        'Open Lyf to set your price and accept or decline.',
      ],
      button: { label: 'View request', url: `${appUrl()}/vendor` },
    }),

  requestAnswered: ({ plannerEmail, plannerName, vendorName, eventTitle, accepted, total, deposit, note, eventId }) =>
    sendMail({
      to: plannerEmail, kind: accepted ? 'booking_accepted' : 'booking_declined',
      subject: accepted ? `${vendorName} accepted your request` : `${vendorName} can't take your request`,
      paragraphs: accepted
        ? [
            `Good news ${esc(first(plannerName))}. ${esc(vendorName)} accepted your request for <strong>${esc(eventTitle)}</strong>.`,
            `Total: <strong>${naira(total)}</strong>. Pay the ${naira(deposit)} deposit (30%) to lock in the date.`,
            ...(note ? [`Note from ${esc(vendorName)}: "${esc(note)}"`] : []),
          ]
        : [
            `${esc(vendorName)} can't take your request for <strong>${esc(eventTitle)}</strong>.`,
            ...(note ? [`Note from ${esc(vendorName)}: "${esc(note)}"`] : []),
            'Other vendors are waiting. Find another one in the app.',
          ],
      button: { label: accepted ? 'Pay deposit' : 'Find another vendor', url: `${appUrl()}/events/${eventId}${accepted ? '' : '/vendors'}` },
    }),

  depositPaidPlanner: ({ plannerEmail, plannerName, vendorName, eventTitle, amount, points, eventId }) =>
    sendMail({
      to: plannerEmail, kind: 'deposit_receipt', subject: `Deposit received for ${vendorName}`,
      paragraphs: [
        `Thanks ${esc(first(plannerName))}. We received your ${naira(amount)} deposit for ${esc(vendorName)} on <strong>${esc(eventTitle)}</strong>.`,
        `You earned ${Number(points).toLocaleString('en-NG')} reward points.`,
      ],
      button: { label: 'View event', url: `${appUrl()}/events/${eventId}` },
    }),

  depositPaidVendor: ({ vendorEmail, vendorName, eventTitle, amount }) =>
    sendMail({
      to: vendorEmail, kind: 'deposit_paid', subject: 'A planner paid the deposit',
      paragraphs: [`${esc(vendorName)} has a new paid booking: <strong>${esc(eventTitle)}</strong>.`, `Deposit received: ${naira(amount)}.`],
      button: { label: 'Open bookings', url: `${appUrl()}/vendor` },
    }),

  newReview: ({ vendorEmail, rating, comment }) =>
    sendMail({
      to: vendorEmail, kind: 'review', subject: `You got a ${rating}-star review on Lyf`,
      paragraphs: [`A planner rated you ${rating} out of 5.`, ...(comment ? [`"${esc(comment)}"`] : [])],
      button: { label: 'See your reviews', url: `${appUrl()}/vendor` },
    }),
};
