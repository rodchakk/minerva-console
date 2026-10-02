import { redirect } from "next/navigation";
import { getConsoleAccessContext } from "@/features/auth/consoleAccess";

export default async function HomePage() {
  const context = await getConsoleAccessContext();

  if (context.status === "unauthenticated") {
    redirect("/login");
  }

  if (context.status === "authorized") {
    redirect(context.role === "owner" ? "/dashboard" : "/workspace");
  }

  if (
    context.status === "temporarily_unavailable" ||
    context.status === "authorization_error"
  ) {
    redirect("/temporarily-unavailable");
  }

  redirect("/unauthorized");
}
