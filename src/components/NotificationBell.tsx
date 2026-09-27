"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMyNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/actions/notifications";
import { formatDateTime } from "@/lib/utils";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: Date;
};

// Notification interne à l'app (pas un push navigateur) : la cloche se met à
// jour toute seule par sondage périodique, pour qu'un livreur assigné à une
// course la voie sans avoir à recharger la page — voir getMyNotifications
// dans src/lib/actions/notifications.ts.
export function NotificationBell({ theme = "light" }: { theme?: "light" | "dark" }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  function refresh() {
    getMyNotifications().then((res) => {
      setNotifications(res.notifications);
      setUnreadCount(res.unreadCount);
    });
  }

  // Sondage périodique d'un système externe (la base, via un server action) :
  // exactement l'usage qu'un effet est censé couvrir — jamais un rendu
  // synchrone possible ici, contrairement à une simple synchronisation d'état
  // dérivé (voir l'idiome "ajustement pendant le rendu" utilisé ailleurs,
  // ex. Sidebar.tsx, pour ce second cas).
  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleClick(n: Notification) {
    if (!n.read) await markNotificationRead(n.id);
    setOpen(false);
    refresh();
    if (n.link) router.push(n.link);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center justify-center h-8 w-8 rounded-lg transition-colors ${
          theme === "dark" ? "text-slate-300 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
        }`}
        title="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={async () => {
                    await markAllNotificationsRead();
                    refresh();
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>
            {notifications.length === 0 && (
              <p className="px-4 py-6 text-sm text-slate-400 text-center">Aucune notification.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-50 last:border-0 ${
                  n.read ? "text-slate-500" : "text-slate-800 bg-blue-50/40"
                }`}
              >
                <p className={n.read ? "" : "font-medium"}>{n.message}</p>
                <p className="text-xs text-slate-400 mt-0.5">{formatDateTime(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
