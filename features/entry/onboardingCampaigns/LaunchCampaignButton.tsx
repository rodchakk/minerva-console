"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  launchOnboardingCampaign,
  type LaunchCampaignActionResult,
  type LaunchCampaignSummary,
} from "@/features/entry/onboardingCampaigns/actions";

export type CampaignPreviewCounts = {
  ready: number;
  missingEmail: number;
  alreadyInvited: number;
  alreadyActivated: number;
};

type LaunchCampaignButtonProps = {
  communityId: string;
  communityName: string;
  preview: CampaignPreviewCounts;
};

const DEFAULT_RATE = 10;

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      {children}
    </div>
  );
}

function ResultModalBody({
  result,
  onClose,
}: {
  result: LaunchCampaignActionResult;
  onClose: () => void;
}) {
  if (!result.success) {
    return (
      <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-rose-400/20 bg-[var(--surface-elevated)] p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-white">
          Could not launch campaign
        </h3>
        <p className="text-sm text-[var(--text-muted)]">{result.error}</p>
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    );
  }

  const { data } = result as { success: true; data: LaunchCampaignSummary };
  const noWork = data.ready_to_send === 0;

  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
      <h3 className="text-lg font-semibold text-white">Campaign created</h3>
      <p className="text-sm leading-6 text-[var(--text-muted)]">
        {noWork
          ? "No eligible residents were found. The campaign was closed immediately."
          : "The campaign was created and is now in running state. Emails will be sent gradually once email delivery is enabled."}
      </p>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Status
          </p>
          <p className="mt-1 font-semibold text-white">{data.status}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Dry run
          </p>
          <p className="mt-1 font-semibold text-white">
            {data.dry_run ? "Yes" : "No"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Ready to send
          </p>
          <p className="mt-1 font-semibold text-white">{data.ready_to_send}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Missing email
          </p>
          <p className="mt-1 font-semibold text-white">
            {data.skipped_missing_email}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Already invited
          </p>
          <p className="mt-1 font-semibold text-white">{data.already_invited}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
          <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
            Already activated
          </p>
          <p className="mt-1 font-semibold text-white">{data.already_activated}</p>
        </div>
      </div>

      <p className="text-xs leading-5 text-[var(--text-muted)] break-all">
        Campaign id: <span className="font-mono">{data.campaign_id}</span>
      </p>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}

export function LaunchCampaignButton({
  communityId,
  communityName,
  preview,
}: LaunchCampaignButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirming" | "loading" | "result">(
    "idle",
  );
  const [result, setResult] = useState<LaunchCampaignActionResult | null>(null);
  const [rate, setRate] = useState<number>(DEFAULT_RATE);
  const [includeAlreadyInvited, setIncludeAlreadyInvited] = useState(false);

  const projectedReady =
    preview.ready + (includeAlreadyInvited ? preview.alreadyInvited : 0);
  const canLaunch = projectedReady > 0 && Boolean(communityId);

  async function handleConfirm() {
    setPhase("loading");
    const actionResult = await launchOnboardingCampaign({
      communityId,
      sendRatePerMinute: rate,
      includeAlreadyInvited,
    });
    setResult(actionResult);
    setPhase("result");
    // Force a refresh once the modal closes — the queue rows may have changed
    // status if the campaign auto-completed with no work.
    if (actionResult.success) {
      router.refresh();
    }
  }

  function handleClose() {
    setResult(null);
    setPhase("idle");
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        onClick={() => setPhase("confirming")}
        disabled={phase !== "idle" || !communityId}
        title={
          !communityId
            ? "Select a community first."
            : "Create an email onboarding campaign for prepared residents."
        }
      >
        Launch onboarding campaign
      </Button>

      {phase === "confirming" ? (
        <Overlay>
          <div className="flex w-full max-w-lg flex-col gap-4 rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] p-6 shadow-xl">
            <div>
              <h3 className="text-lg font-semibold text-white">
                Launch onboarding campaign
              </h3>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                {communityName ? `Community: ${communityName}` : null}
              </p>
            </div>

            <p className="text-sm leading-6 text-[var(--text-muted)]">
              This will create an email onboarding campaign for prepared
              residents. Emails will be sent gradually once email delivery is
              enabled.
            </p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Residents ready
                </p>
                <p className="mt-1 font-semibold text-white">{preview.ready}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Missing email
                </p>
                <p className="mt-1 font-semibold text-white">
                  {preview.missingEmail}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Already invited
                </p>
                <p className="mt-1 font-semibold text-white">
                  {preview.alreadyInvited}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Already activated
                </p>
                <p className="mt-1 font-semibold text-white">
                  {preview.alreadyActivated}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[var(--surface-strong)] p-3">
              <label
                htmlFor="send-rate"
                className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-muted)]"
              >
                Send rate (emails / minute)
              </label>
              <input
                id="send-rate"
                type="number"
                min={1}
                max={60}
                value={rate}
                onChange={(event) =>
                  setRate(
                    Math.max(
                      1,
                      Math.min(60, Number(event.target.value) || DEFAULT_RATE),
                    ),
                  )
                }
                className="mt-2 h-10 w-full rounded-xl border border-white/10 bg-[var(--surface)] px-3 text-sm text-white outline-none focus:border-violet-400/50"
              />
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                The worker will process at most this many messages per minute.
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={includeAlreadyInvited}
                onChange={(event) => setIncludeAlreadyInvited(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-[var(--primary)]"
              />
              <span>
                Also re-send to residents already in <Badge tone="info">invited</Badge>
                {" "}status ({preview.alreadyInvited}).
              </span>
            </label>

            <div className="rounded-2xl border border-amber-400/18 bg-amber-500/8 px-3 py-2 text-xs text-amber-100">
              Campaign will be created in running state, but no emails will leave
              the system until email delivery is enabled (dry-run mode). PINs are
              never persisted in campaign messages.
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setPhase("idle")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={!canLaunch}
                title={
                  canLaunch
                    ? "Launch the campaign."
                    : "No residents available to launch this campaign."
                }
              >
                Launch campaign
              </Button>
            </div>
          </div>
        </Overlay>
      ) : null}

      {phase === "loading" ? (
        <Overlay>
          <div className="rounded-[28px] border border-[var(--border)] bg-[var(--surface-elevated)] px-8 py-6 shadow-xl">
            <p className="text-sm font-semibold text-white">
              Creating onboarding campaign...
            </p>
          </div>
        </Overlay>
      ) : null}

      {phase === "result" && result !== null ? (
        <Overlay>
          <ResultModalBody result={result} onClose={handleClose} />
        </Overlay>
      ) : null}
    </>
  );
}
