import { redirect } from "next/navigation";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

export default async function HomePage() {
  const context = await getAuthContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorized") {
    redirect("/dashboard");
  }

  if (context.status === "authorization_error") {
    redirect("/unauthorized?reason=authorization_error");
  }

  redirect("/unauthorized");
}
