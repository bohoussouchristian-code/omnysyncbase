import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-1 min-h-screen">
      <Sidebar userName={user.name} userRole={user.role} />
      <main className="flex-1 min-w-0 pt-14 lg:pt-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
