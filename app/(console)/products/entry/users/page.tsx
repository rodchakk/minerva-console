import { PageHeader } from "@/components/layout/PageHeader";
import { UserSearch } from "@/features/entry/users/UserSearch";

export default function EntryUsersPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="ENTRY users"
        description="Search users through the production admin RPC and prepare future support actions from a single product workspace."
      />
      <UserSearch />
    </div>
  );
}
