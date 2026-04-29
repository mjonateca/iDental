import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureAccountRecords } from "@/lib/account-repair";
import { createAdminClient, createClient } from "@/lib/supabase/server";

const waitlistSchema = z.object({
  shop_id: z.string().uuid(),
  barber_id: z.string().uuid().optional().nullable(),
  service_id: z.string().uuid().optional().nullable(),
  preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  preferred_start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  preferred_end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional().nullable(),
  guest_count: z.coerce.number().int().min(1).max(8).optional().default(1),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const account = await ensureAccountRecords(user);
  if (account.role !== "client" || !account.client) {
    return NextResponse.json({ error: "Solo clientes pueden unirse a la waitlist" }, { status: 403 });
  }

  const parsed = waitlistSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const { data: shop } = await admin.from("shops").select("id, is_active").eq("id", parsed.data.shop_id).maybeSingle();
  if (!shop?.is_active) {
    return NextResponse.json({ error: "Clínica dental no disponible" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("waitlist_entries")
    .insert({
      ...parsed.data,
      client_id: account.client.id,
      status: "pending",
      notes: parsed.data.notes || null,
      barber_id: parsed.data.barber_id || null,
      service_id: parsed.data.service_id || null,
      preferred_start_time: parsed.data.preferred_start_time || null,
      preferred_end_time: parsed.data.preferred_end_time || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const shopId = searchParams.get("shop_id");
  if (!shopId) return NextResponse.json({ error: "shop_id requerido" }, { status: 400 });

  const { data: shop } = await supabase.from("shops").select("id").eq("id", shopId).eq("owner_id", user.id).single();
  if (!shop) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabase
    .from("waitlist_entries")
    .select("*, clients(name, phone, whatsapp), barbers(display_name), services(name)")
    .eq("shop_id", shopId)
    .order("preferred_date")
    .order("created_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
