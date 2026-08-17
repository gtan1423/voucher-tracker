// Checked hourly by pg_cron (see 0001_vouchers.sql). For each user with notifications
// enabled, sends a status email only when it's currently their configured day/hour in
// their configured timezone, and only once per ~6 days (guards against being checked
// more than once inside the same hour-long window).
//
// Deploy: paste into Supabase dashboard -> Edge Functions -> Create function
// (exact slug "voucher-weekly-email"). Needs a RESEND_API_KEY secret set under
// Edge Functions -> Secrets. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected.
//
// This function is invoked by pg_cron with the project's anon key, not a user JWT --
// leave "Verify JWT" ON when creating it (the anon key satisfies that check).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface VoucherStatusRow {
  id: string;
  name: string;
  value: number | null;
  value_note: string | null;
  expiry_date: string | null;
  type: string;
  ageing_bucket: string;
  days_until_expiry: string;
  status: string;
}

interface NotificationSettingsRow {
  user_id: string;
  recipient_email: string;
  day_of_week: number;
  hour: number;
  timezone: string;
  enabled: boolean;
  last_sent_at: string | null;
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

function localDateParts(now: Date, timeZone: string): { dow: number; hour: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekdayStr = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const hourStr = parts.find((p) => p.type === "hour")?.value ?? "0";
  const dowMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hour = Number(hourStr);
  if (hour === 24) hour = 0; // Intl can format midnight as "24" in hour12:false
  return { dow: dowMap[weekdayStr] ?? 0, hour };
}

function buildEmailHtml(vouchers: VoucherStatusRow[]): string {
  const overdue = vouchers.filter((v) => v.ageing_bucket === "(1) Overdue");
  const soon = vouchers.filter((v) => v.ageing_bucket === "(2) 0-30 Days");
  const openCount = vouchers.filter((v) => v.status === "Open").length;
  const totalValue = vouchers.reduce((sum, v) => sum + (typeof v.value === "number" ? v.value : 0), 0);

  const list = (rows: VoucherStatusRow[]) =>
    rows.length
      ? `<ul style="padding-left:18px;margin:8px 0;">${rows
          .map(
            (v) =>
              `<li style="margin-bottom:4px;"><strong>${escapeHtml(v.name)}</strong>` +
              (v.expiry_date ? ` — expires ${escapeHtml(v.expiry_date)} (${escapeHtml(v.days_until_expiry)})` : "") +
              `</li>`,
          )
          .join("")}</ul>`
      : `<p style="color:#888;margin:8px 0;">None</p>`;

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2421;">
    <h2 style="color:#0f766e;margin-bottom:4px;">Your voucher status</h2>
    <p style="color:#555;margin-top:0;">${openCount} open vouchers &middot; total value $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>

    <h3 style="color:#b91c1c;margin-bottom:4px;">Overdue (${overdue.length})</h3>
    ${list(overdue)}

    <h3 style="color:#92400e;margin-bottom:4px;">Expiring in 30 days (${soon.length})</h3>
    ${list(soon)}

    <p style="color:#999;font-size:12px;margin-top:24px;">Sent automatically by your Voucher Tracker.</p>
  </div>`;
}

Deno.serve(async (_req) => {
  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY not configured" }), { status: 500 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const now = new Date();

    const { data: settingsRows, error: settingsError } = await admin
      .from("voucher_notification_settings")
      .select("*")
      .eq("enabled", true);

    if (settingsError) throw settingsError;

    const results: unknown[] = [];

    for (const settings of (settingsRows ?? []) as NotificationSettingsRow[]) {
      const { dow, hour } = localDateParts(now, settings.timezone || "UTC");
      if (dow !== settings.day_of_week || hour !== settings.hour) continue;

      if (settings.last_sent_at) {
        const daysSinceLastSend = (now.getTime() - new Date(settings.last_sent_at).getTime()) / 86_400_000;
        if (daysSinceLastSend < 6) continue; // already sent this week's window
      }

      const { data: vouchers, error: vErr } = await admin
        .from("voucher_status")
        .select("*")
        .eq("user_id", settings.user_id);
      if (vErr) throw vErr;

      const rows = (vouchers ?? []) as VoucherStatusRow[];
      const overdueCount = rows.filter((v) => v.ageing_bucket === "(1) Overdue").length;
      const soonCount = rows.filter((v) => v.ageing_bucket === "(2) 0-30 Days").length;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Voucher Tracker <onboarding@resend.dev>",
          to: settings.recipient_email,
          subject: `Voucher status: ${overdueCount} overdue, ${soonCount} expiring soon`,
          html: buildEmailHtml(rows),
        }),
      });

      if (!emailRes.ok) {
        results.push({ user_id: settings.user_id, sent: false, error: await emailRes.text() });
        continue;
      }

      await admin
        .from("voucher_notification_settings")
        .update({ last_sent_at: now.toISOString() })
        .eq("user_id", settings.user_id);

      results.push({ user_id: settings.user_id, sent: true });
    }

    return new Response(JSON.stringify({ checked: settingsRows?.length ?? 0, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
