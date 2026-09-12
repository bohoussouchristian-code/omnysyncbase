"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

const WEEKDAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_SHORT = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function parseISO(iso: string): Date | null {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Grille du mois alignée Lundi→Dimanche, avec cases vides en début/fin de mois.
function buildMonthGrid(year: number, month: number): (Date | null)[][] {
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// Sélecteur de période réutilisable : calendrier visuel avec sélection de
// plage (clic date de début, puis date de fin, jours intermédiaires
// surlignés), un panneau récapitulatif à gauche, et n'applique la sélection
// qu'au clic sur "Valider". Utilisé dans Caisse et Rapports.
export function DateRangePicker({
  from,
  to,
  onApply,
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [rangeStart, setRangeStart] = useState<Date | null>(null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  function toggle() {
    if (!open) {
      const start = parseISO(from);
      const end = parseISO(to);
      setRangeStart(start);
      setRangeEnd(end);
      const anchor = start || new Date();
      setViewYear(anchor.getFullYear());
      setViewMonth(anchor.getMonth());
    }
    setOpen((v) => !v);
  }

  function pickDay(day: Date) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(day);
      setRangeEnd(null);
    } else if (day < rangeStart) {
      setRangeEnd(rangeStart);
      setRangeStart(day);
    } else {
      setRangeEnd(day);
    }
  }

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  function apply() {
    if (!rangeStart) return;
    const end = rangeEnd || rangeStart;
    onApply(toISO(rangeStart), toISO(end));
    setOpen(false);
  }

  const label = from && to ? `${formatDate(from)} — ${formatDate(to)}` : "Choisir une période";
  const daysCount =
    rangeStart && rangeEnd
      ? Math.round((rangeEnd.getTime() - rangeStart.getTime()) / 86400000) + 1
      : null;
  const grid = buildMonthGrid(viewYear, viewMonth);
  const today = new Date();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        title={label}
        aria-label={label}
        className="flex items-center justify-center rounded-lg border border-slate-300 h-9 w-9 text-slate-600 hover:bg-slate-50"
      >
        <CalendarDays size={16} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-[380px] bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900 text-sm">Sélectionner la date</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <div className="flex">
              <div className="w-24 shrink-0 bg-blue-600 text-white flex flex-col items-center justify-center text-center py-6 px-2">
                {daysCount != null && rangeStart ? (
                  <>
                    <p className="text-xs opacity-80">
                      {MONTHS_SHORT[rangeStart.getMonth()]} {rangeStart.getFullYear()}
                    </p>
                    <p className="text-2xl font-bold leading-tight mt-1">{daysCount}</p>
                    <p className="text-xs opacity-80">jour{daysCount > 1 ? "s" : ""}</p>
                  </>
                ) : (
                  <>
                    <p className="text-lg font-semibold opacity-70">—</p>
                    <p className="text-lg font-semibold opacity-70 mt-2">—</p>
                  </>
                )}
              </div>
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3 text-sm font-medium text-slate-700">
                  <button type="button" onClick={() => changeMonth(-1)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                    <ChevronLeft size={16} />
                  </button>
                  <span>{MONTHS[viewMonth]}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y - 1)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span>{viewYear}</span>
                    <button
                      type="button"
                      onClick={() => setViewYear((y) => y + 1)}
                      className="p-1 rounded hover:bg-slate-100 text-slate-400"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <button type="button" onClick={() => changeMonth(1)} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center text-xs text-slate-400 mb-1">
                  {WEEKDAYS.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
                <div className="space-y-0.5">
                  {grid.map((week, wi) => (
                    <div key={wi} className="grid grid-cols-7">
                      {week.map((day, di) => {
                        if (!day) return <div key={di} className="h-8" />;
                        const isStart = rangeStart && sameDay(day, rangeStart);
                        const isEnd = rangeEnd && sameDay(day, rangeEnd);
                        const isInRange =
                          rangeStart && rangeEnd && day > rangeStart && day < rangeEnd;
                        const isToday = sameDay(day, today);
                        return (
                          <button
                            key={di}
                            type="button"
                            onClick={() => pickDay(day)}
                            className={`h-8 w-8 mx-auto flex items-center justify-center text-sm rounded-full transition-colors ${
                              isStart || isEnd
                                ? "bg-blue-600 text-white font-semibold"
                                : isInRange
                                  ? "bg-blue-100 text-blue-700"
                                  : isToday
                                    ? "border border-blue-300 text-slate-700"
                                    : "text-slate-600 hover:bg-slate-100"
                            }`}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={apply}
              disabled={!rangeStart}
              className="w-full rounded-none bg-blue-600 text-white py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Valider
            </button>
          </div>
        </>
      )}
    </div>
  );
}
