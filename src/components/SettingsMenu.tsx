import Link from "next/link";
import { SlidersVertical } from "lucide-react";

export function SettingsMenu({ theme = "light" }: { theme?: "light" | "dark" }) {
  return (
    <Link
      href="/administration"
      title="Administration"
      className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
        theme === "dark" ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <SlidersVertical size={18} />
    </Link>
  );
}
