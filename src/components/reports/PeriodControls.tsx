"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { DateRangePicker } from "@/components/DateRangePicker";

const PERIODS = ["7j", "30j", "90j"] as const;

export function PeriodControls({
  basePath,
  activePeriode,
  isCustom,
  from,
  to,
}: {
  basePath: string;
  activePeriode: string;
  isCustom: boolean;
  from: string;
  to: string;
}) {
  const router = useRouter();

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p}
          href={`${basePath}?periode=${p}`}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
            !isCustom && activePeriode === p
              ? "bg-blue-600 text-white border-blue-600"
              : "border-slate-300 text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p}
        </Link>
      ))}
      <DateRangePicker
        from={from}
        to={to}
        onApply={(f, t) => router.push(`${basePath}?from=${f}&to=${t}`)}
      />
    </div>
  );
}
