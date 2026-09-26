export function formatMoney(value: number) {
  return (
    new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(
      Math.round(value)
    ) + " FCFA"
  );
}

const UNITS_0_19 = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf",
  "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize", "dix-sept", "dix-huit", "dix-neuf",
];

function tensWord(ten: number): string {
  switch (ten) {
    case 2: return "vingt";
    case 3: return "trente";
    case 4: return "quarante";
    case 5: return "cinquante";
    case 6: return "soixante";
    case 8: return "quatre-vingt";
    default: return "";
  }
}

// Écrit un nombre de 0 à 99 en toutes lettres, avec les irrégularités du
// français (soixante-dix, quatre-vingts, "et un"...).
function twoDigitsToWords(n: number): string {
  if (n < 20) return UNITS_0_19[n];
  const ten = Math.floor(n / 10);
  const unit = n % 10;
  if (ten === 7 || ten === 9) {
    const base = tensWord(ten === 7 ? 6 : 8);
    if (ten === 7 && unit === 1) return `${base} et onze`;
    return unit === 0 ? `${base}-dix` : `${base}-${UNITS_0_19[10 + unit]}`;
  }
  if (unit === 0) return ten === 8 ? "quatre-vingts" : tensWord(ten);
  if (unit === 1) return ten === 8 ? "quatre-vingt-un" : `${tensWord(ten)} et un`;
  return `${tensWord(ten)}-${UNITS_0_19[unit]}`;
}

// Écrit un nombre de 0 à 999 en toutes lettres.
function threeDigitsToWords(n: number): string {
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = "";
  if (hundred > 0) {
    str = hundred === 1 ? "cent" : `${UNITS_0_19[hundred]} cent`;
    if (rest === 0 && hundred > 1) str += "s";
  }
  if (rest > 0) str += (str ? " " : "") + twoDigitsToWords(rest);
  return str;
}

const SCALES: { value: number; singular: string; plural: string }[] = [
  { value: 1_000_000_000, singular: "milliard", plural: "milliards" },
  { value: 1_000_000, singular: "million", plural: "millions" },
  { value: 1_000, singular: "mille", plural: "mille" },
];

// "vingt" et "cent" ne prennent le "s" du pluriel que s'ils terminent le
// nombre — dès qu'un multiplicateur (mille, million...) les suit, ce "s"
// disparaît ("quatre-vingts" mais "quatre-vingt mille", "deux cents" mais
// "deux cent mille").
function dropTrailingPluralForScale(s: string): string {
  if (s.endsWith("vingts")) return s.slice(0, -1);
  if (s.endsWith("cents")) return s.slice(0, -1);
  return s;
}

// Écrit un entier positif en toutes lettres (français).
export function numberToWordsFr(value: number): string {
  let remaining = Math.floor(Math.abs(value));
  if (remaining === 0) return "zéro";

  const parts: string[] = [];
  for (const scale of SCALES) {
    const count = Math.floor(remaining / scale.value);
    if (count > 0) {
      const multiplier = dropTrailingPluralForScale(threeDigitsToWords(count));
      // "mille" ne prend jamais "un" devant lui ni de "s" au pluriel.
      parts.push(
        scale.value === 1000
          ? count === 1 ? "mille" : `${multiplier} mille`
          : count === 1 ? `un ${scale.singular}` : `${multiplier} ${scale.plural}`
      );
      remaining -= count * scale.value;
    }
  }
  if (remaining > 0) parts.push(threeDigitsToWords(remaining));
  return parts.join(" ");
}

// Montant en toutes lettres pour les documents imprimés (factures, reçus,
// bons de commande) — ex. "Dix-sept mille francs CFA".
export function amountInWordsFcfa(value: number): string {
  const rounded = Math.round(Math.abs(value));
  const words = numberToWordsFr(rounded);
  const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
  return `${capitalized} franc${rounded > 1 ? "s" : ""} CFA`;
}

export function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function generateNumber(prefix: string) {
  const now = new Date();
  const y = now.getFullYear().toString().slice(2);
  const m = (now.getMonth() + 1).toString().padStart(2, "0");
  const d = now.getDate().toString().padStart(2, "0");
  const rand = Math.floor(Math.random() * 9000 + 1000);
  return `${prefix}-${y}${m}${d}-${rand}`;
}

export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function toCSV(headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  return "﻿" + lines.join("\n");
}
