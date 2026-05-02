import { redirect } from "next/navigation";
import { getAuthContext } from "@/features/auth/requireSuperadmin";

export default async function HomePage() {
  const { user, isSuperadmin } = await getAuthContext();

  if (!user) {
    redirect("/login");
  }

  redirect(isSuperadmin ? "/dashboard" : "/unauthorized");
}
