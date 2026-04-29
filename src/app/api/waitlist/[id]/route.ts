import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  status: z.enum(["pending", "notified", "booked", "cancelled", "expired"]),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: entry } = await supabase
    .from("waitlist_entries")
    .select("id, shop_id, shops!inner(owner_id)")
    .eq("id", id)
    .single();

  const nestedShop = entry?.shops as unknown as { owner_id: string } | Array<{ owner_id: string }> | null;
  const ownerId = Array.isArray(nestedShop) ? nestedShop[0]?.owner_id : nestedShop?.owner_id;
  if (!entry || ownerId !== user.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const updates = {
    status: parsed.data.status,
    notified_at: parsed.data.status === "notified" ? new Date().toISOString() : null,
  };

  const { data, error } = await supabase.from("waitlist_entries").update(updates).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
