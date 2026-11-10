import "server-only";
import { supabaseService } from "./supabase/server";

/**
 * Transactional email through Resend's HTTP API (free tier: 3,000 emails a month).
 * Without RESEND_API_KEY the email is printed to the server log instead, so local
 * development works with no account. Sending never throws: a failed email must not
 * break the action that triggered it.
 */
const SITE = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const FROM = () => process.env.EMAIL_FROM ?? "Daliapply <hello@daliapply.com>";
export const SALES_EMAIL = () => process.env.SALES_EMAIL ?? "sales@daliapply.com";
export const SUPPORT_EMAIL = () => process.env.SUPPORT_EMAIL ?? "support@daliapply.com";

type Mail = { to: string | string[]; subject: string; text: string; replyTo?: string };

export async function sendEmail(mail: Mail) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info(`[email] (not sent, RESEND_API_KEY unset) to=${mail.to} subject="${mail.subject}"\n${mail.text}`);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to: mail.to, subject: mail.subject, text: mail.text, reply_to: mail.replyTo }),
    });
    if (!res.ok) console.error(`[email] Resend ${res.status}: ${await res.text()}`);
  } catch (e) {
    console.error("[email] send failed", e);
  }
}

async function emailOf(userId: string) {
  const { data } = await supabaseService().auth.admin.getUserById(userId);
  return data.user?.email ?? null;
}

const footer = () => `\n\n---\nDaliapply · ${SITE()}\nYou get this email because you have a Daliapply account.`;

/** Both sides of a new match. */
export async function notifyMatch(jobId: string, seekerId: string) {
  const db = supabaseService();
  const { data: m } = await db
    .from("matches")
    .select("id, created_at, jobs(title, company_id, companies(name)), seekers(first_name)")
    .eq("job_id", jobId).eq("seeker_id", seekerId).maybeSingle();
  // only right after the match is made, so a repeat swipe never re-sends
  if (!m || Date.now() - new Date(m.created_at).getTime() > 60_000) return;
  const job = m.jobs as unknown as { title: string; company_id: string; companies: { name: string } };
  const seeker = m.seekers as unknown as { first_name: string };
  const link = `${SITE()}/matches/${m.id}`;
  const [seekerEmail, companyEmail] = await Promise.all([emailOf(seekerId), emailOf(job.company_id)]);
  await Promise.all([
    seekerEmail && sendEmail({
      to: seekerEmail,
      subject: `It's a match: ${job.title} at ${job.companies.name}`,
      text: `Good news! ${job.companies.name} is interested in you for ${job.title}, and you swiped right on them too.\n\nSay hello: ${link}${footer()}`,
    }),
    companyEmail && sendEmail({
      to: companyEmail,
      subject: `New match for ${job.title}: ${seeker.first_name}`,
      text: `${seeker.first_name} matched with your ${job.title} post. Their full name, salary and resume are now unlocked.\n\nOpen the match: ${link}${footer()}`,
    }),
  ]);
}

/** The other party of a chat, at most once every 15 minutes per conversation. */
export async function notifyMessage(matchId: string, senderId: string, body: string) {
  const db = supabaseService();
  const { data: m } = await db.from("matches").select("seeker_id, jobs(title, company_id, companies(name)), seekers(first_name)").eq("id", matchId).single();
  if (!m) return;
  const job = m.jobs as unknown as { title: string; company_id: string; companies: { name: string } };
  const seeker = m.seekers as unknown as { first_name: string };
  const to = senderId === m.seeker_id ? job.company_id : m.seeker_id;
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await db.from("messages").select("id", { count: "exact", head: true })
    .eq("match_id", matchId).eq("sender_id", senderId).gt("created_at", since);
  if ((count ?? 0) > 1) return; // already told them about this burst
  const email = await emailOf(to);
  if (!email) return;
  const from = senderId === m.seeker_id ? seeker.first_name : job.companies.name;
  await sendEmail({
    to: email,
    subject: `New message from ${from} about ${job.title}`,
    text: `${from} wrote:\n\n"${body.slice(0, 500)}${body.length > 500 ? "…" : ""}"\n\nReply: ${SITE()}/matches/${matchId}${footer()}`,
  });
}

/** Company: their payment was approved (job live) or rejected. */
export async function notifyPaymentReviewed(paymentId: string) {
  const db = supabaseService();
  const { data: p } = await db.from("payments").select("company_id, job_id, job_title, status, review_note").eq("id", paymentId).single();
  if (!p?.company_id) return;
  const email = await emailOf(p.company_id);
  if (!email) return;
  const link = `${SITE()}/company/jobs/${p.job_id}`;
  await sendEmail(p.status === "approved"
    ? { to: email, subject: `Your job is live: ${p.job_title}`, text: `We've confirmed your payment, and ${p.job_title} is now live for 30 days. Candidates are waiting.\n\nSee candidates: ${link}${footer()}` }
    : { to: email, subject: `We couldn't confirm your payment for ${p.job_title}`, text: `We couldn't confirm your payment${p.review_note ? `: ${p.review_note}` : "."}\n\nPlease check the reference number and send it again: ${link}\n\nIf you think this is a mistake, reply to this email.${footer()}`, replyTo: SALES_EMAIL() });
}

/** Company: their post was taken down after a report. */
export async function notifyTakedown(jobId: string, note: string | null) {
  const db = supabaseService();
  const { data: j } = await db.from("jobs").select("title, company_id").eq("id", jobId).single();
  const email = j && (await emailOf(j.company_id));
  if (!email) return;
  await sendEmail({
    to: email,
    subject: `Your job post was taken down: ${j.title}`,
    text: `We took down ${j.title} after a report${note ? `: ${note}` : "."} Seekers no longer see it.\n\nIf you think this is a mistake, reply to this email.${footer()}`,
    replyTo: SUPPORT_EMAIL(),
  });
}

/** Sales inbox: a company sent a payment and receipt. */
export async function notifySales(paymentId: string) {
  const db = supabaseService();
  const { data: p } = await db.from("payments").select("*").eq("id", paymentId).single();
  if (!p) return;
  const receipt = p.proof_path ? (await db.storage.from("receipts").createSignedUrl(p.proof_path, 7 * 86_400)).data?.signedUrl : null;
  const companyEmail = p.company_id ? await emailOf(p.company_id) : null;
  await sendEmail({
    to: SALES_EMAIL(),
    subject: p.subject,
    text: `${p.body}\n\n---\nReceipt (link works for 7 days): ${receipt ?? "none attached"}\nReview and publish: ${SITE()}/admin`,
    replyTo: companyEmail ?? undefined,
  });
}

/** Support inbox: a contact form message. */
export async function notifySupport(m: { email: string; topic: string; body: string }) {
  await sendEmail({ to: SUPPORT_EMAIL(), subject: `[Support] ${m.topic}`, text: `From: ${m.email}\n\n${m.body}\n\n---\nAll messages: ${SITE()}/admin`, replyTo: m.email });
}
