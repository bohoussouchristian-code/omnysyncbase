import Link from "next/link";
import { SlidersVertical } from "lucide-react";

export function SettingsMenu({ theme = "light" }: { theme?: "light" | "dark" }) {
  return (
    <Link
      href="/administration"
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium w-full transition-colors ${
        theme === "dark" ? "text-slate-300 hover:bg-slate-800 hover:text-white" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      <SlidersVertical size={18} />
      Administration
    </Link>
  );
}
