import { redirect } from "next/navigation";

export default function AchatsClientsPage() {
  redirect("/ventes?tab=achats");
}
