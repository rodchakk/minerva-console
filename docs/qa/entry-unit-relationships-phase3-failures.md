# Full-suite failure comparison

Base e37d5504: 742 / 698 passed / 44 failed. Phase 3: 746 / 702 passed / 44 failed.
Same Node v24.16.0 and installed dependencies. Names normalized only by removing execution time; line numbers are not compared.

| Test | Base | Phase 3 | Classification |
|---|---|---|---|
| Activation Queue exposes follow-up summary, quick filters and repeated-invite guidance | Fail | Fail | Preexisting |
| Activation Queue standardizes selected-community return navigation | Fail | Fail | Preexisting |
| Community Registration admin card replaces Submitted states with unit progress | Fail | Fail | Preexisting |
| Community Users keeps resident and admin creation structurally identical | Fail | Fail | Preexisting |
| Community Users uses canonical community-detail return action | Fail | Fail | Preexisting |
| ENTRY Communities owns directory lifecycle semantics | Fail | Fail | Preexisting |
| ENTRY Operations is an action-focused workspace | Fail | Fail | Preexisting |
| Field People exposes profile and unit controls for ADMIN accounts | Fail | Fail | Preexisting |
| Field explains that the token-free browser address is not the shareable registration link | Fail | Fail | Preexisting |
| Field mutations require explicit confirmation and Preview disables controls | Fail | Fail | Preexisting |
| Field overview does not silently turn unavailable aggregate counts into zero | Fail | Fail | Preexisting |
| Field people read model preserves unavailable states | Fail | Fail | Preexisting |
| Field registration card provides Copy, Share (feature detected), and Open actions for open recoverable state | Fail | Fail | Preexisting |
| Field user detail exposes account status management for every ENTRY role | Fail | Fail | Preexisting |
| Minerva Console generates and sends its own branded one-time invitation email | Fail | Fail | Preexisting |
| New SECURITY DEFINER functions revoke public/anonymous and require authentication | Fail | Fail | Preexisting |
| Outrider is intentionally narrow on Operations | Fail | Fail | Preexisting |
| Reset and activation helper decisions are conservative | Fail | Fail | Preexisting |
| a recorded payment remains successful when proof attachment fails | Fail | Fail | Preexisting |
| canonical email sender uses the existing PIN/link and persists invited state only on accepted delivery | Fail | Fail | Preexisting |
| community Create user uses the same resident access picker while preserving non-resident quick creation | Fail | Fail | Preexisting |
| community detail preserves its customer link through legacy-compatible routes | Fail | Fail | Preexisting |
| dashboard is the Minerva Control Center landing surface | Fail | Fail | Preexisting |
| degraded mode allows only bounded mobile communication workers | Fail | Fail | Preexisting |
| existing 001E sharing and 001F launch behavior remain present | Fail | Fail | Preexisting |
| global People route is search-first and does not render all people | Fail | Fail | Preexisting |
| global People username profile matches require resident membership | Fail | Fail | Preexisting |
| global sidebar keeps ENTRY navigation on the ENTRY accent boundary | Fail | Fail | Preexisting |
| invite form hides credentials, requires email and has no password in confirmation/success | Fail | Fail | Preexisting |
| invite uses shared preparation and canonical email flow with server-derived context | Fail | Fail | Preexisting |
| login flow uses Console access context and preserves unauthorized behavior | Fail | Fail | Preexisting |
| non-resident detail is visible but resident-only writes stay gated | Fail | Fail | Preexisting |
| password mode retains credentials confirmation, creation and copy screen | Fail | Fail | Preexisting |
| preview form disables invitation and mode selection | Fail | Fail | Preexisting |
| public duplicate responses do not expose resident information | Fail | Fail | Preexisting |
| public registration reads references only as optional helper metadata | Fail | Fail | Preexisting |
| quick create does not broaden into admin, guard, or destructive account management | Fail | Fail | Preexisting |
| resident detail exposes status controls through the Field resident action | Fail | Fail | Preexisting |
| resident detail keeps the whole household visible and selectable | Fail | Fail | Preexisting |
| resident detail renders the profile editor only for residents | Fail | Fail | Preexisting |
| resident-only profile and recovery actions remain resident-only | Fail | Fail | Preexisting |
| tests\minerva-field-foundation.test.mjs | Fail | Fail | Preexisting |
| unit resident creation asks how access should be delivered before creating anything | Fail | Fail | Preexisting |
| unknown totals render truthful metrics without a percentage progress bar | Fail | Fail | Preexisting |

Three branch-scope failures from the previous PR revision now pass. No failures are newly introduced in this comparison. Original causes outside this MVP were not changed.
