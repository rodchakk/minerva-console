-- Keep the new QA completion helper internal to Outrider backend execution.
revoke all on function public._outrider_complete_sections_v2(
  text[], text, text, boolean, text[], boolean, text, integer, text, text, text
) from public, anon, authenticated;

comment on function public._outrider_complete_sections_v2(
  text[], text, text, boolean, text[], boolean, text, integer, text, text, text
) is
  'Internal Outrider completion helper. Not callable by public, anon, or authenticated roles.';
