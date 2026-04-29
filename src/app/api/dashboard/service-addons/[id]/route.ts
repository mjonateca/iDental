import { NextResponse } from "next/server";
import { getAuthenticatedContext, isSubscriptionAccessible } from "@/lib/server-authz";

async function assertAddonOwner(id: string) {
  const context = await getAuthenticatedContext();
  if (context.response) return { ...context, addon: null };

  const { data: addon } = await context.supabase
    .from("service_addons")
    .select("id, service_id, services!inner(shop_id, shops!inner(owner_id))")
    .eq("id", id)
    .single();

  const servicesData = addon?.services as
    | { shop_id: string; shops?: { owner_id: string } | Array<{ owner_id: string }> | null }
    | Array<{ shop_id: string; shops?: { owner_id: string } | Array<{ owner_id: string }> | null }>
    | null;
  const serviceRow = Array.isArray(servicesData) ? servicesData[0] : servicesData;
  const nestedShop = Array.isArray(serviceRow?.shops) ? serviceRow?.shops[0] : serviceRow?.shops;

  if (!addon || nestedShop?.owner_id !== context.user.id) {
    return {
      ...context,
      addon: null,
      response: NextResponse.json({ error: "No autorizado" }, { status: 403 }),
    };
  }

  return { ...context, addon: { ...addon, shop_id: serviceRow?.shop_id }, response: null };
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const context = await assertAddonOwner(id);
  if (context.response) return context.response;

  const { data: subscription } = await context.supabase
    .from("shop_subscriptions")
    .select("status, current_period_end")
    .eq("shop_id", context.addon.shop_id)
    .maybeSingle();

  if (!isSubscriptionAccessible(subscription?.status, subscription?.current_period_end)) {
    return NextResponse.json({ error: "Tu suscripción no está activa." }, { status: 402 });
  }

  const { error } = await context.supabase.from("service_addons").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
