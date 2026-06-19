import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, expense_type, category, project_id, total_amount, vendor_name } = body;

    const supabase = createAdminClient();

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (expense_type !== undefined) updateData.expense_type = expense_type;
    if (category !== undefined) updateData.category = category;
    if (project_id !== undefined) updateData.project_id = project_id;
    if (total_amount !== undefined) updateData.total_amount = total_amount;
    if (vendor_name !== undefined) updateData.vendor_name = vendor_name;

    const { data, error } = await supabase
      .from("expenses")
      .update(updateData)
      .eq("id", id)
      .select("*, project:projects(*)")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ expense: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Fetch the expense first to delete its receipt from storage
    const { data: expense } = await supabase
      .from("expenses")
      .select("receipt_url")
      .eq("id", id)
      .single();

    if (expense?.receipt_url) {
      await supabase.storage.from("documents").remove([expense.receipt_url]);
    }

    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete expense";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
