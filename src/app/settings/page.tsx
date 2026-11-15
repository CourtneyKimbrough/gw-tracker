import Link from "next/link";

import { BillingRow } from "@/components/settings/billing-row";
import { DeleteAccountRow } from "@/components/settings/delete-account-row";
import { HomeAirportSetting } from "@/components/settings/home-airport-setting";
import { SignOutRow } from "@/components/settings/sign-out-row";
import { getAuthenticatedUser } from "@/lib/auth";
import { listTrackedAirports } from "@/lib/data/airports";
import { getOrCreateUserProfile } from "@/lib/data/users";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  // middleware.ts redirects signed-out visitors to /login before this ever renders.
  if (!user || !user.email) {
    return null;
  }

  const [profile, airports] = await Promise.all([
    getOrCreateUserProfile(supabase, user.id, user.email),
    listTrackedAirports(supabase),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Settings</h1>

      <HomeAirportSetting airports={airports} currentCode={profile.homeAirport} />

      <div className="flex items-center justify-between border-b border-border py-4">
        <div>
          <div className="text-sm text-foreground">Email</div>
          <div className="text-xs text-foreground-muted">{profile.email}</div>
        </div>
      </div>

      <Link
        href="/notifications"
        className="flex items-center justify-between border-b border-border py-4"
      >
        <div className="text-sm text-foreground">Notification preferences</div>
        <span className="text-sm text-accent">View →</span>
      </Link>

      <BillingRow plan={profile.plan} />
      <SignOutRow />
      <DeleteAccountRow />
    </div>
  );
}
