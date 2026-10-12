import { redirect } from "next/navigation";

// Legacy console entry point. The product registry is now Minerva's home.
export default function DashboardPage() {
  redirect("/products");
}
