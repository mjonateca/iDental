type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
};

type SendEmailResult =
  | { ok: true; id?: string | null }
  | { ok: false; error: string };

export async function sendEmail({ to, subject, html, replyTo }: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    return { ok: false, error: "Falta configurar RESEND_API_KEY y RESEND_FROM_EMAIL." };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      html,
      reply_to: replyTo ? [replyTo] : undefined,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, error: payload?.message || payload?.error || "No se pudo enviar el correo." };
  }

  return { ok: true, id: payload?.id || null };
}
