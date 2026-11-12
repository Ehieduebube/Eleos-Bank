/**
 * Seed the primary demo account in Supabase.
 *
 *   npm run db:seed            # create/update the demo login and provision its account
 *   npm run db:seed -- --reset # also wipe and re-seed its demo history
 *
 * Requires (in .env.local or the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   DEMO_ACCOUNT_EMAIL, DEMO_ACCOUNT_PASSWORD
 *
 * The password comes from your environment — nothing is hard-coded here.
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_USER } from "../src/server/config";
import { seedToJson } from "../src/server/repository/supabase-mapping";
import { buildDemoSeed } from "../src/server/seed/demo-seed";

try {
  process.loadEnvFile(".env.local");
} catch {
  // fall back to the process environment
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✗ Missing ${name}. Add it to .env.local (see .env.example).`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || required("SUPABASE_SECRET_KEY");
  const email = required("DEMO_ACCOUNT_EMAIL").toLowerCase();
  const password = required("DEMO_ACCOUNT_PASSWORD");
  const reset = process.argv.includes("--reset");

  if (password.length < 8) {
    console.error("✗ DEMO_ACCOUNT_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const metadata = { full_name: DEMO_USER.fullName, demo: true };

  // Find or create the demo auth user.
  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    userId = data.users.find((u) => u.email?.toLowerCase() === email)?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, { password, user_metadata: metadata, email_confirm: true });
    if (error) throw error;
    console.log(`• Demo user exists (${email}); password and metadata refreshed.`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: metadata });
    if (error) throw error;
    userId = data.user.id;
    console.log(`• Created demo user ${email}.`);
  }

  const seed = buildDemoSeed({ userId, email, fullName: DEMO_USER.fullName, phone: DEMO_USER.phone });
  const fn = reset ? "app_reset_demo_account" : "app_provision_demo_account";
  const { data: changed, error: rpcError } = await admin.rpc(fn, { p_user_id: userId, p_seed: seedToJson(seed) });
  if (rpcError) throw rpcError;
  console.log(changed ? `• Demo account ${reset ? "reset" : "provisioned"} with seeded history.` : "• Demo account already provisioned (use --reset to start over).");

  const { data: account, error: accountError } = await admin.from("accounts").select("account_number, balance").eq("user_id", userId).single();
  if (accountError) throw accountError;
  const naira = (Number(account.balance) / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 });
  console.log(`✓ Account ${account.account_number} balance: ₦${naira} (simulated)`);
}

main().catch((error) => {
  console.error("✗ Seeding failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
