import { Shell } from "@/components/layout/Shell";
import { requireSuperadmin } from "@/features/auth/requireSuperadmin";

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSuperadmin();

  return <Shell email={user.email}>{children}</Shell>;
}
