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
  start_date: string | null;
  expiry_date: string | null;
  type: string;
  interest: string;
  ageing_bucket: string;
  days_until_expiry: string;
  status: string;
}

const INTEREST_RANK: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

function sortByPriority(rows: VoucherStatusRow[]): VoucherStatusRow[] {
  return [...rows].sort((a, b) => (INTEREST_RANK[b.interest] ?? 0) - (INTEREST_RANK[a.interest] ?? 0));
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

// Overdue, 0-30, and 31-60 day buckets -- anything further out or already
// actioned (Expired/Redeemed, filtered out by the caller) isn't urgent yet.
const AGEING_WINDOW = new Set(["(1) Overdue", "(2) 0-30 Days", "(3) 31-60 Days"]);
const STARTING_SOON_DAYS = 30;

function formatValue(v: VoucherStatusRow): string {
  if (typeof v.value === "number") {
    return `$${v.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return v.value_note ? escapeHtml(v.value_note) : "—";
}

// Whole-day difference between an ISO date string and `now`, both treated as
// plain dates (matches the DB view's use of `current_date`, not a timestamp).
function daysUntil(dateISO: string, now: Date): number {
  const target = new Date(dateISO + "T00:00:00Z");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

// Renders one "<h3>Category — $total</h3><ul>...</ul>" block per category
// (Type), sorted alphabetically, with rows inside each sorted High->Low
// priority. `detail` renders whatever per-item context differs between the
// expiring-soon and starting-soon sections (expiry vs. start date).
function groupByCategoryHtml(rows: VoucherStatusRow[], detail: (v: VoucherStatusRow) => string): string {
  const byType = new Map<string, VoucherStatusRow[]>();
  for (const v of rows) {
    const key = v.type || "Other";
    if (!byType.has(key)) byType.set(key, []);
    byType.get(key)!.push(v);
  }

  return [...byType.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, typeRows]) => {
      const rowsSorted = sortByPriority(typeRows);
      const categoryTotal = rowsSorted.reduce((sum, v) => sum + (typeof v.value === "number" ? v.value : 0), 0);
      const items = rowsSorted
        .map(
          (v) =>
            `<li style="margin-bottom:4px;"><strong>${escapeHtml(v.name)}</strong>` +
            ` <span style="color:#888;">(${escapeHtml(v.interest || "Medium")} priority)</span>` +
            ` — ${formatValue(v)}` +
            detail(v) +
            `</li>`,
        )
        .join("");
      return `
        <h3 style="color:#0f766e;margin-bottom:2px;">${escapeHtml(type)} <span style="color:#888;font-weight:normal;">— $${categoryTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></h3>
        <ul style="padding-left:18px;margin:4px 0 14px;">${items}</ul>`;
    })
    .join("");
}

function buildEmailHtml(actionable: VoucherStatusRow[], now: Date): string {
  const inWindow = sortByPriority(actionable.filter((v) => AGEING_WINDOW.has(v.ageing_bucket)));
  const totalValue = inWindow.reduce((sum, v) => sum + (typeof v.value === "number" ? v.value : 0), 0);
  const expiringHtml = groupByCategoryHtml(inWindow, (v) =>
    v.expiry_date ? `, expires ${escapeHtml(v.expiry_date)} (${escapeHtml(v.days_until_expiry)})` : "",
  );

  const startingSoon = sortByPriority(
    actionable.filter((v) => {
      if (!v.start_date) return false;
      const d = daysUntil(v.start_date, now);
      return d >= 0 && d <= STARTING_SOON_DAYS;
    }),
  );
  const startingSoonHtml = groupByCategoryHtml(startingSoon, (v) => {
    const d = daysUntil(v.start_date!, now);
    return `, starts ${escapeHtml(v.start_date!)} (${d === 0 ? "today" : `in ${d} days`})`;
  });

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:560px;margin:0 auto;color:#1f2421;">
    <h2 style="color:#0f766e;margin-bottom:4px;">Your voucher status</h2>
    <p style="color:#555;margin-top:0;">${inWindow.length} vouchers expiring within 60 days &middot; total value $${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>

    ${expiringHtml || '<p style="color:#888;">Nothing expiring within 60 days.</p>'}

    <h2 style="color:#0f766e;margin-bottom:4px;margin-top:28px;">Starting within 30 days</h2>
    ${startingSoonHtml || '<p style="color:#888;">Nothing starting within 30 days.</p>'}

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
      // Expired and already-redeemed vouchers are no longer actionable -- exclude them
      // from the email entirely rather than just noting their status.
      const actionable = rows.filter((v) => v.status !== "Expired" && v.status !== "Redeemed");
      const inWindow = actionable.filter((v) => AGEING_WINDOW.has(v.ageing_bucket));
      const overdueCount = inWindow.filter((v) => v.ageing_bucket === "(1) Overdue").length;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Voucher Tracker <onboarding@resend.dev>",
          to: settings.recipient_email,
          subject: `Voucher status: ${overdueCount} overdue, ${inWindow.length} expiring within 60 days`,
          html: buildEmailHtml(actionable, now),
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
