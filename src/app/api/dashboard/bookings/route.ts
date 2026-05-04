import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnedActiveShop } from "@/lib/server-authz";
import { createAdminClient } from "@/lib/supabase/server";

const manualBookingSchema = z.object({
  shop_id: z.string().uuid(),
  barber_id: z.string().uuid(),
  service_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  client_name: z.string().min(1),
  client_phone: z.string().optional(),
});

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export async function POST(request: Request) {
  // Must be authenticated shop owner
  const context = await requireOwnedActiveShop();
  if (context.response) return context.response;

  const parsed = manualBookingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const d = parsed.data;

  // Verify the booking is for this shop
  if (d.shop_id !== context.shop.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  if (timeToMinutes(d.end_time) <= timeToMinutes(d.start_time)) {
    return NextResponse.json({ error: "Horario inválido" }, { status: 400 });
  }

  const admin = await createAdminClient();

  // Fetch full shop details
  const { data: shopFull } = await admin
    .from("shops")
    .select("id, country_code, country_name, city")
    .eq("id", d.shop_id)
    .single();

  // Verify barber & service belong to this shop
  const [{ data: barber }, { data: service }] = await Promise.all([
    admin.from("barbers").select("id, shop_id, is_active").eq("id", d.barber_id).maybeSingle(),
    admin.from("services").select("id, shop_id, is_active, price, currency").eq("id", d.service_id).maybeSingle(),
  ]);

  if (!barber?.is_active || barber.shop_id !== d.shop_id) {
    return NextResponse.json({ error: "Profesional no disponible" }, { status: 409 });
  }
  if (!service?.is_active || service.shop_id !== d.shop_id) {
    return NextResponse.json({ error: "Servicio no disponible" }, { status: 409 });
  }

  // Check for conflicts
  const { data: conflict } = await admin
    .from("bookings")
    .select("id")
    .eq("barber_id", d.barber_id)
    .eq("date", d.date)
    .not("status", "in", '("cancelled","no_show")')
    .or(`and(start_time.lt.${d.end_time},end_time.gt.${d.start_time})`)
    .limit(1)
    .maybeSingle();

  if (conflict) {
    return NextResponse.json({ error: "El horario ya no está disponible" }, { status: 409 });
  }

  // Find or create a walk-in client record for manual bookings
  // We store them in the clients table linked to the shop owner for internal use
  let clientId: string;
  const { data: existingClient } = await admin
    .from("clients")
    .select("id")
    .eq("phone", d.client_phone || "")
    .eq("name", d.client_name)
    .maybeSingle();

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    // Create a minimal client record without a user account
    const { data: newClient, error: clientError } = await admin
      .from("clients")
      .insert({
        name: d.client_name,
        phone: d.client_phone || null,
        whatsapp: d.client_phone || null,
        country_code: shopFull?.country_code || "US",
        country_name: shopFull?.country_name || null,
        city: shopFull?.city || null,
      })
      .select("id")
      .single();

    if (clientError || !newClient) {
      return NextResponse.json({ error: "No se pudo crear el cliente: " + clientError?.message }, { status: 500 });
    }
    clientId = newClient.id;
  }

  // Create the booking as confirmed (manual = already agreed in person)
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .insert({
      client_id: clientId,
      shop_id: d.shop_id,
      barber_id: d.barber_id,
      service_id: d.service_id,
      date: d.date,
      start_time: d.start_time,
      end_time: d.end_time,
      status: "confirmed",
      deposit_status: "none",
      deposit_amount: 0,
      payment_status: "pending",
      payment_required: false,
      payment_amount: service.price || 0,
      payment_currency: service.currency || "USD",
    })
    .select("*, clients(name, phone, whatsapp), barbers(display_name), services(name, duration_min, price)")
    .single();

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 500 });
  }

  return NextResponse.json(booking, { status: 201 });
}
