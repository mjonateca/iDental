import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedContext, isSubscriptionAccessible } from "@/lib/server-authz";

const addonSchema = z.object({
  name: z.string().trim().min(2),
  price: z.coerce.number().min(0),
  duration_min: z.coerce.number().int().min(0).max(240).optional().default(0),
});

async function assertServiceOwner(id: string) {
  const context = await getAuthenticatedContext();
  if (context.response) return { ...context, service: null };

  const { data: service } = await context.supabase
    .from("services")
    .select("id, shop_id, shops!inner(owner_id)")
    .eq("id", id)
    .single();

  const serviceShop = service?.shops as unknown as { owner_id: string } | Array<{ owner_id: string }> | null;
  const ownerId = Array.isArray(serviceShop) ? serviceShop[0]?.owner_id : serviceShop?.owner_id;
  if (!service || ownerId !== context.user.id) {
    return {
      ...context,
      service: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { ...context, service, response: null };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = addonSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const context = await assertServiceOwner(id);
  if (context.response) return context.response;

  const { data: subscription } = await context.supabase
    .from("shop_subscriptions")
    .select("status, current_period_end")
    .eq("shop_id", context.service.shop_id)
    .maybeSingle();

  if (!isSubscriptionAccessible(subscription?.status, subscription?.current_period_end)) {
    return NextResponse.json({ error: "Tu suscripción no está activa." }, { status: 402 });
  }

  const { data, error } = await context.supabase
    .from("service_addons")
    .insert({
      service_id: id,
      name: parsed.data.name,
      price: parsed.data.price,
      duration_min: parsed.data.duration_min,
      is_active: true,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
