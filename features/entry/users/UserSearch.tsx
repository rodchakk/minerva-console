"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { searchUsersAction } from "@/features/entry/users/actions";

function SearchButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Searching..." : "Search users"}
    </Button>
  );
}

export function UserSearch() {
  const [state, formAction] = useActionState(searchUsersAction, { results: [] });

  return (
    <div className="space-y-6">
      <form
        action={formAction}
        className="rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm"
      >
        <div className="flex flex-col gap-4 lg:flex-row">
          <input
            name="query"
            type="text"
            defaultValue={state.query}
            className="min-w-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)] px-4 py-3 outline-none transition focus:border-teal-600"
            placeholder="Search by full name or email"
          />
          <SearchButton />
        </div>
        {state.message ? (
          <p className="mt-4 text-sm text-rose-700">{state.message}</p>
        ) : null}
      </form>

      <div className="space-y-4">
        {state.results?.map((user) => (
          <article
            key={user.id}
            className="flex flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <h3 className="text-lg font-semibold text-slate-950">{user.fullName}</h3>
              <p className="mt-1 text-sm text-slate-600">{user.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Badge tone="info">{user.role}</Badge>
              <Badge tone={user.isActive ? "success" : "warning"}>
                {user.isActive ? "Active" : "Inactive"}
              </Badge>
              <Button variant="secondary" disabled>
                Reset Password coming soon
              </Button>
            </div>
          </article>
        ))}

        {state.results && state.results.length === 0 && state.query ? (
          <div className="rounded-[28px] border border-dashed border-[var(--border)] bg-white px-6 py-10 text-center text-sm text-slate-600 shadow-sm">
            No users matched <span className="font-semibold">{state.query}</span>.
          </div>
        ) : null}
      </div>
    </div>
  );
}
