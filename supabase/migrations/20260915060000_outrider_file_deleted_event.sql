-- Extend Outrider audit-event vocabulary for public source-file removal.

alter table public.community_outrider_events
  drop constraint if exists community_outrider_events_type_check;

alter table public.community_outrider_events
  add constraint community_outrider_events_type_check
  check (
    event_type = any (
      array[
        'outrider_started'::text,
        'outrider_saved'::text,
        'file_uploaded'::text,
        'outrider_submitted'::text,
        'information_requested'::text,
        'outrider_approved'::text,
        'link_rotated'::text,
        'setup_workbook_uploaded'::text,
        'setup_report_generated'::text,
        'setup_report_superseded'::text,
        'setup_report_approved'::text,
        'file_deleted'::text
      ]
    )
  );
