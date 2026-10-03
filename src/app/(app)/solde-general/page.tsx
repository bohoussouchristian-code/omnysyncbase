import { redirect } from "next/navigation";

// Fusionné dans Comptes bancaires (voir src/app/(app)/tresorerie/page.tsx) —
// cette route ne sert plus qu'à rediriger un éventuel lien/favori existant.
export default function SoldeGeneralPage() {
  redirect("/tresorerie");
}
