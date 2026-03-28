import { createClient } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: coachProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (coachProfile?.role !== "coach") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const clientId = (body?.client_id as string | undefined)?.trim();
  if (!clientId || !UUID_REGEX.test(clientId)) {
    return NextResponse.json({ error: "Valid client_id is required" }, { status: 400 });
  }

  const { data: targetClient, error: targetClientError } = await supabase
    .from("client_profiles")
    .select("id, coach_id")
    .eq("id", clientId)
    .single();

  if (targetClientError || !targetClient) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  if (targetClient.coach_id !== user.id) {
    return NextResponse.json({ error: "You can only delete your own clients" }, { status: 403 });
  }

  const { data: targetProfile, error: targetProfileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", clientId)
    .single();

  if (targetProfileError || targetProfile?.role !== "client") {
    return NextResponse.json({ error: "Target account is not a client" }, { status: 400 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server configuration error: missing service role key" },
      { status: 500 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(clientId);
  if (deleteUserError) {
    return NextResponse.json({ error: deleteUserError.message }, { status: 400 });
  }

  return NextResponse.json({ deleted: true, client_id: clientId });
}
