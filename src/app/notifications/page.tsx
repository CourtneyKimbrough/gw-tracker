import { ActiveAlerts } from "@/components/notifications/active-alerts";
import { NotificationHistory } from "@/components/notifications/notification-history";
import { getAuthenticatedUser } from "@/lib/auth";
import { listAlertsForUser, listNotificationsForUser } from "@/lib/data/alerts";
import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  // middleware.ts redirects signed-out visitors to /login before this ever renders.
  if (!user) {
    return null;
  }

  const [alerts, notificationPage] = await Promise.all([
    listAlertsForUser(supabase, user.id),
    listNotificationsForUser(supabase, user.id, null),
  ]);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold text-foreground">Notifications</h1>

      <section className="mb-8">
        <h2 className="mb-2 px-1 text-sm font-medium text-foreground-muted">Active alerts</h2>
        <ActiveAlerts initialAlerts={alerts} />
      </section>

      <section>
        <h2 className="mb-2 px-1 text-sm font-medium text-foreground-muted">History</h2>
        <NotificationHistory
          initialNotifications={notificationPage.notifications}
          initialCursor={notificationPage.nextCursor}
        />
      </section>
    </div>
  );
}
