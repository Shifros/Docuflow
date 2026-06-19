import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status } = body;

    if (!status) {
      return NextResponse.json({ error: "status is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("revenue_entries")
      .update({ status })
      .eq("id", id)
      .select("*, project:projects(*), client:clients(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ revenue_entry: data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update revenue entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
