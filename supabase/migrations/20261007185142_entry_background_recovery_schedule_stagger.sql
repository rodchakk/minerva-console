-- Stagger ENTRY database-only recovery jobs so they do not all start on the
-- same minute while preserving their original cadence. This migration does not
-- activate any job.

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='entry-observability-incident-reconcile'),
  schedule := '2-59/5 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='community-message-push-stale-sweeper'),
  schedule := '3-59/5 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='cleanup-edge-rate-limits'),
  schedule := '4-59/15 * * * *'
);

select cron.alter_job(
  job_id := (select jobid from cron.job where jobname='expire-stale-records'),
  schedule := '1-59/5 * * * *'
);
