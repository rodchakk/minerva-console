# ENTRY Mobile Release 1.0.2 — 2026-09-02 Closeout

**Record ID:** `ENTRY-REL-001`

**Status:** CLOSED — ENTRY 1.0.2 is publicly distributed on Google Play and released through App Store Connect.

## Scope

This record captures the production mobile release work completed across EAS Build, Google Play Console, Android developer verification, and App Store Connect for ENTRY Access Control (`com.minervatechnologies.entry`).

This is a release/distribution closeout. It does not claim new product implementation, database migrations, or new Console behavior.

## EAS production build

A production build was created from the ENTRY mobile repository with:

`npx eas-cli@latest build --platform all --profile production`

EAS resolved the production profile and loaded the existing public Supabase runtime configuration from the build profile.

### Android

- Production `versionCode` incremented from `11` to `12`.
- EAS used remote Android credentials hosted by Expo.
- EAS used the existing default Android keystore / Build Credentials configuration.
- Android build completed successfully and produced an `.aab` artifact.
- Package id remained `com.minervatechnologies.entry`.

### iOS

- Production `buildNumber` incremented from `10` to `11` in EAS remote versioning.
- EAS authenticated successfully with the Apple Developer account after an initial failed password attempt.
- Apple team: `Rodolfo Chacon (A6PARNV77S)`.
- Bundle identifier `com.minervatechnologies.entry` was registered/synced successfully.
- Capabilities and capability identifiers required no updates.
- Existing distribution certificate and provisioning profile were fetched successfully.
- Distribution certificate and provisioning profile were active and reported an expiration of April 23, 2027.
- Push Notifications were reported as configured.
- iOS build completed successfully and produced an `.ipa` artifact.

A non-blocking EAS warning noted that `ios.buildNumber` in app config is ignored when version source is remote. Future cleanup may remove that redundant local field, but it did not block this release.

## Android developer verification

Google Play Console's **Android developer verification** page was reviewed for ENTRY.

Verified in Play Console:

- App: `ENTRY Access Control`.
- Package: `com.minervatechnologies.entry`.
- Package status: **Registered**.
- Signing keys shown by Play Console: **3**.
- Play Console showed the package registration last updated April 29, 2026.

This satisfies the package-registration/signing-key portion of Google's September 30, 2026 Android developer verification requirement for ENTRY. No new package registration or signing-key action was required during this session.

The separate Identity tab was not independently captured in this release closeout; this record therefore does not make a new identity-verification claim beyond the package/key evidence above.

## Google Play production release

Google Play Console showed ENTRY production release **1.0.2** as **Available on Google Play**.

During release verification, attempting to upload the newly generated Android artifact returned:

`Version code 12 has already been used. Try another version code.`

This confirmed that Play already knew `versionCode 12`; the operator then confirmed the current 1.0.2 production release was public. No unnecessary `versionCode 13` rebuild was created.

Release state recorded for Brain:

- Version name: **1.0.2**.
- Production: **public / available on Google Play**.
- EAS production build associated with this release cycle: `versionCode 12`.
- Android developer verification package status: **Registered**.

## Apple release

App Store Connect initially showed:

- iOS App Version **1.0.2**.
- Status: **Pending Developer Release**.

This meant Apple's review was complete and the release was waiting for the developer-controlled release action.

The operator selected **Release This Version**. App Store Connect then showed:

- iOS App Version **1.0.2**.
- Status: **Ready for Distribution**.

Brain therefore records ENTRY 1.0.2 as released through App Store Connect and ready for App Store distribution.

The EAS production build created in this release cycle used `buildNumber 11`. The App Store Connect Build subsection was not independently reopened in this session after release, so this closeout records the EAS build number and the App Store version state as separate verified facts rather than inventing an unobserved linkage.

## Apple administrative follow-up

App Store Connect displayed a notice titled **New Age Ratings Responses Required for Social Media**.

The notice states that new social-media capability questions exist in App Information and that answers become required September 7, 2026 unless a new app is submitted or existing answers in that section are updated earlier.

This did **not** block ENTRY 1.0.2 from reaching Ready for Distribution. It is an administrative follow-up for future App Store work and should be completed before it becomes a submission blocker.

## Relationship to ENTRY-SUP-001

`ENTRY-SUP-001 — Native Support Tickets` previously closed as code-complete and merged while explicitly leaving public mobile-store distribution as a separate release operation.

This release closeout closes that distribution boundary for ENTRY 1.0.2: the public mobile release has now been performed. The support-ticket record should no longer describe mobile-store publication as still pending for this release cycle.

This closeout does not add push notifications for support tickets; that enhancement remains separate.

## Final release state

As of 2026-09-02:

- **ENTRY Android 1.0.2:** public in Google Play Production.
- **Android production versionCode:** 12 used in this release cycle.
- **Android developer verification:** package registered, 3 signing keys shown.
- **ENTRY iOS 1.0.2:** Ready for Distribution after manual developer release.
- **EAS iOS production buildNumber:** 11 in this release cycle.
- **iOS signing/provisioning:** ready and active during build.
- **Push Notifications capability:** configured during EAS credential validation.
- **Remaining administrative follow-up:** answer Apple's new Age Ratings / social-media questions by the applicable September 7, 2026 requirement.

## Final Verdict

`ENTRY-REL-001` is **COMPLETE**.

ENTRY 1.0.2 completed its production mobile distribution cycle across Android and iOS. No additional Android rebuild was necessary, Android package/signing-key registration was already compliant, and Apple's developer-controlled release was completed successfully.
