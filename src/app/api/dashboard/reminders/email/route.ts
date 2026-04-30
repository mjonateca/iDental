import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { requireOwnedActiveShop } from "@/lib/server-authz";
import { createAdminClient } from "@/lib/supabase/server";

const schema = z.object({
  booking_id: z.string().uuid(),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const admin = await createAdminClient();
  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, shop_id, client_id, date, start_time, status, clients(id, user_id, name), barbers(display_name), services(name)")
    .eq("id", parsed.data.booking_id)
    .eq("shop_id", context.shop.id)
    .single();

  if (error || !booking) {
    return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });
  }

  const bookingRecord = booking as unknown as {
    id: string;
    shop_id: string;
    client_id: string | null;
    date: string | null;
    start_time: string;
    status: string;
    clients: { id?: string; user_id?: string | null; name?: string | null } | null;
    barbers: { display_name?: string | null } | null;
    services: { name?: string | null } | null;
  };

  if (["cancelled", "completed", "no_show"].includes(bookingRecord.status)) {
    return NextResponse.json({ error: "Solo se pueden recordar reservas pendientes o confirmadas." }, { status: 409 });
  }

  const clientUserId = bookingRecord.clients?.user_id;
  if (!clientUserId) {
    return NextResponse.json({ error: "El cliente no tiene una cuenta vinculada para enviar recordatorio." }, { status: 409 });
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("email")
    .eq("user_id", clientUserId)
    .maybeSingle();

  if (!profile?.email) {
    return NextResponse.json({ error: "El cliente no tiene correo registrado." }, { status: 409 });
  }

  const ownerEmail = context.account?.profile?.email || undefined;
  const clinicName = context.account?.profile?.business_name || "Tu clínica dental";
  const reminderDate = bookingRecord.date ? new Date(`${bookingRecord.date}T12:00:00`) : null;
  const formattedDate = reminderDate
    ? reminderDate.toLocaleDateString("es-DO", { weekday: "long", day: "numeric", month: "long" })
    : booking.date;

  const subject = `${clinicName}: recordatorio de tu cita`;
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.55; color: #16324a;">
      <h2 style="margin-bottom: 12px;">Recordatorio de cita</h2>
      <p>Hola ${bookingRecord.clients?.name || "cliente"},</p>
      <p>Te recordamos que tienes una cita en <strong>${clinicName}</strong>.</p>
      <p>
        <strong>Fecha:</strong> ${formattedDate || "Pendiente"}<br />
        <strong>Hora:</strong> ${bookingRecord.start_time.slice(0, 5)}<br />
        <strong>Servicio:</strong> ${bookingRecord.services?.name || "Consulta"}<br />
        <strong>Dentista:</strong> ${bookingRecord.barbers?.display_name || "Por asignar"}
      </p>
      <p>Si necesitas reprogramar, responde a este correo.</p>
    </div>
  `;

  const sent = await sendEmail({
    to: profile.email,
    subject,
    html,
    replyTo: ownerEmail,
  });

  await admin.from("notification_events").insert({
    booking_id: bookingRecord.id,
    shop_id: context.shop.id,
    client_id: bookingRecord.client_id,
    channel: "email",
    type: "booking_reminder",
    status: sent.ok ? "sent" : "failed",
    sent_at: sent.ok ? new Date().toISOString() : null,
    error: sent.ok ? null : sent.error,
    payload: {
      to: profile.email,
      subject,
      reply_to: ownerEmail || null,
    },
  });

  if (!sent.ok) {
    return NextResponse.json({ error: sent.error }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "Recordatorio enviado por correo." });
}
