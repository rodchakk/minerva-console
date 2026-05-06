import { redirect } from "next/navigation";

export default function OnboardingPage() {
  redirect("/products/entry/communities?filter=pending_setup");
}
