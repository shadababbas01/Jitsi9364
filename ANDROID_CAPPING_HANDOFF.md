# Android capping: implementation handoff

This covers bringing plan capping (quota limits, plan-unavailable features and server meeting-duration signals) to the Melp Android app, at parity with the web client in `~/meet.melp`.

## Repositories

| | Jitsi (React Native SDK) | Client app |
| --- | --- | --- |
| Path | `~/Jitsi9364` | `~/AndroidStudioProjects/melpappandroid` |
| Branch at start | `capping3nov` @ `e89674efc` | `282capping` @ `4c6bc7877b` |
| How the client uses it | Built into a local Maven repo and consumed as `org.jitsi.react:jitsi-meet-sdk:+` (`build.gradle` points at `/Users/shadababbas/Desktop/ttsrepo126`) | |
| Owns | Meeting screen, capping state and gates, the popup | Payment webview (`WebviewCappingActivity`), meeting activity (`MelpMeetSDk`) |

## The brief's main assumption did not hold

The brief and `ANDROID_CAPPING_IMPLEMENTATION_GUIDE.md` were written against `meet.melp`, where the shared capping layer already exists and Android would only need a popup. Jitsi9364 had none of it: no `meeting-warning` feature, no `featureUsageLimits` or `featureAccessFlags`, no `meetingLimitDialog` state, and no duration-signal detector.

The shared layer was therefore ported from `meet.melp`, taking only the capping parts. The web's unrelated JWT changes (config overrides, webinar handling, moderator and convid plumbing, the `getJwt` URL decoding) were left out.

## What was ported (shared layer)

| Piece | File | Notes |
| --- | --- | --- |
| JWT quotas and access flags | `react/features/base/jwt/middleware.ts` | Normalizes the `features` claim (top level or `context.features`, object or JSON string) into `featureUsageLimits` and `featureAccessFlags` on `SET_JWT`. |
| Local usage counter | `base/jwt/reducer.ts`, `base/jwt/actionTypes.ts` | `INCREMENT_FEATURE_USAGE`. `SET_FEATURE_USAGE_LIMITS` was not ported because nothing dispatches it. |
| Access-flag check | `base/jwt/functions.ts` | `isJwtAccessFeatureBlocked`, with both `noisesupression` and `noisesuppression` spellings. |
| Popup state | `chat/reducer.ts`, `chat/actionTypes.ts` | `features/chat.meetingLimitDialog` = `{ open, title, message, ended }`. |
| Show/hide actions (Phase 1) | `chat/actions.any.ts` | Platform-neutral. Both `actions.native.ts` and `actions.web.ts` already re-export `actions.any`, so no compatibility shim was needed. |
| Quota helpers | `meeting-warning/functions.ts` | Same as the web version (`checkFeatureUsage`, `commitFeatureUsage`, `softAlertForUse`, `alertServerCountedUsage`, popup builders), importing from `actions.any`. It also holds `detectMeetingSignal` and `meetingSignalDialog`, moved out of the chat middleware so they can be unit tested. |
| Gates | `meeting-warning/middleware.any.ts` (loaded through `middleware.native.ts` / `middleware.web.ts`) | Only the cases that have an Android path (see below). It is the first import in `app/middlewares.native.ts`, so it sees an action before the feature middleware does. |
| Duration signals | `chat/middleware.ts` | Regular and private conference messages, plus `NON_PARTICIPANT_MESSAGE_RECEIVED`, open the popup and are kept out of chat. "This call is limited to N minutes" is dropped from chat, as on web. |
| Copy | `lang/main.json` and the `de`, `es`, `fr`, `hi`, `pt`, `vi` files | The `meetingLimit` block from `meet.melp`. Jitsi9364 has no `esUS`, `frCA`, `lo` or `ptBR` files. |
| Image | `images/callLimitImage.png` | Copied from `meet.melp`. |

## Implemented features

| Feature | Android entry point | Gate | Counting |
| --- | --- | --- | --- |
| Live captions | Video screen, overflow menu, `LiveCaptionsOverflowButton` (`toolbox/components/native/OverflowMenu.tsx`). Dispatches `SET_REQUESTING_SUBTITLES`. Moderator starts. | `meeting-warning/middleware.ts`, `SET_REQUESTING_SUBTITLES` and `TOGGLE_REQUESTING_SUBTITLES`. Gates a local moderator turning captions on. Turning off, remote syncs (`fromRemoteSync`) and non-moderators (already refused by `subtitles/sessionMiddleware.native.ts`) pass through. A blocked enable also turns voice translation off, as on web. | Same as web: hard block, then post-use soft alert. The middleware does not increment locally (web does not either for this feature). |
| Speech-to-speech (s2s-v2) | Translate button (`s2s-v2/components/native/S2SV2PanelButton.tsx`) on the audio screen (`UpperTextContainer.js`) and video side toolbar, and the overflow `S2SV2Button`. Dispatches `START_S2S_V2_SESSION`. Moderator starts. | `START_S2S_V2_SESSION` for a local moderator. A remote session arrives as `SET_S2S_V2_SESSION` and is never gated. | Server-counted. No local increment. |
| Voice translation | `VoiceTranslationPanel.tsx` (local moderator `enableVoiceTranslation()`); the panel mostly opens on a remote start. | `ENABLE_VOICE_TRANSLATION` with `broadcast: true` from a local moderator. Remote (`broadcast: false`) passes. | Server-counted. |
| Poll creation | Polls pane (`polls/components/native/PollsPane.tsx`), reached through the chat route, which now only has the Polls tab. Everyone. | The Create a poll button (`polls/components/AbstractPollsPane.tsx`) blocks when the limit is 0 or used up. Submit (`AbstractPollCreate.tsx`) runs `checkFeatureUsage('polls')` before sending. | `commitFeatureUsage('polls', { showPostLimitAlert: false })` after the poll is sent. |
| Breakout rooms | Video screen, overflow, Breakout rooms, Add room (`AddBreakoutRoomButton.tsx`). Moderator. | `createBreakoutRoom` thunk (`breakout-rooms/actions.ts`) via `checkFeatureAccess`: plural "unavailable" popup when `breakoutrooms` is false. | None (on/off entitlement). |
| Server recording | The "Suggest recording" notification (`recording/actions.any.ts`, direct start) and `StartRecordingDialog` (`AbstractStartRecordingDialog.ts`). | `checkFeatureUsage('recording')` before `conference.startRecording`. Added to match the `payment/IOS` branch; web only caps local recording, which Android cannot do. | Server-counted: `alertServerCountedUsage('recording')` after the start. |
| Melp Pad | `SharedDocumentButton.native.ts` (not rendered anywhere on Android today). | `checkFeatureAccess('melp_pad')` before navigating to the document, as on `payment/IOS`. | None. |
| Whiteboard | No local button. It opens when a web moderator opens it (`whiteboard/middleware.any.ts` dispatches `SET_WHITEBOARD_OPEN`). | `SET_WHITEBOARD_OPEN`, as on web: closed when `whiteboard` is false; a moderator sees the popup, a participant is closed silently. | None. |
| Duration warning / ended | Server messages from `mod_muc_call_limit` | `detectMeetingSignal` in the chat middleware | n/a |

### Why polls differ from the web path

On web, new polls go through `SAVE_POLL`, which the middleware gates. On Android, `AbstractPollCreate` sends `COMMAND_NEW_POLL` straight to the conference, and `SAVE_POLL` only fires when `polls-history` restores old polls. A `SAVE_POLL` gate would miss every new poll and would count restored history as new polls. So the check and commit sit at the create button and the submit instead. The behaviour matches web: the button treats a limit of 0 as blocked, submit uses the generic `used >= limit` rule, the use is counted after sending, and there is no last-unit alert.

## Not implemented because absent on Android

| Feature | Evidence | Left unchanged | What adding it would need |
| --- | --- | --- | --- |
| Local recording | `LocalRecordingManager.native.ts` `isSupported()` returns false, so `START_LOCAL_RECORDING` never fires. Server recording is capped instead (above). | `recording/` local path | A native local-recording start that dispatches `START_LOCAL_RECORDING`; then add the web middleware case. |
| Noise suppression | `NoiseSuppressionButton` is not imported by any native file. | `noise-suppression/` | A native button using the shared thunk, plus the web `SET_NOISE_SUPPRESSION_ENABLED` case. |
| AI summary | No `SET_SUMMARY_ENABLED` action or summary UI anywhere in Jitsi9364. | n/a | The feature itself. |
| Ask AI | No Ask AI UI natively; `ask_ai` is only a JWT key. | n/a | The feature, with the access and quota checks before the request and `alertServerCountedUsage` after. |
| Interview questions / CV-JD upload | No native flow. | n/a | The feature, with the check before upload or generation and the commit after success. |
| Evaluation mode | See the conflict below. | `video-layout/`, `conference/components/native/carmode/` | |

## Conflict: car mode is not evaluation mode here

The brief maps evaluation mode to `SET_CAR_MODE`. In `meet.melp`, car mode is the base of the evaluation-mode feature (candidate selection, `requestCarMode`, `CarModeParticipantsDialog`). In Jitsi9364 it is stock Jitsi driving mode: `CarMode.tsx` dispatches `SET_CAR_MODE` on mount for everyone, and there is no candidate or request flow. Gating it with the `evaluationmode` entitlement and quota would block or count the wrong feature, and the screen would already be open when the action was refused.

It was left ungated. If product does want driving mode capped, it needs its own decision and a gate at `OpenCarmodeButton`, before navigation.

## Client and Jitsi integration decisions

| Decision | Choice |
| --- | --- |
| Popup owner | Jitsi. `meeting-warning/components/MeetingLimitDialogContainer.native.tsx`, mounted once in `App.native.tsx` beside `DialogContainer` and `BottomSheetContainer`. The client renders nothing, so there is no double rendering. |
| Upgrade (active meeting) | Client. Jitsi calls `NativeModules.NativeCallsNew.openUpgradePlan()` (new method in `android/sdk/.../OpenMelpModule.java`), which broadcasts `MeetCallBackUpgradePlan`. The client's `EventHandler.openUpgradePlan` opens `WebviewCappingActivity` with the signed-in payment URL (session, Melp ID and device ID), the same URL its other capping entry points build. The meeting keeps running. |
| Why not a browser URL | Only the client has the session values; a plain URL from Jitsi would land on a signed-out page. The web-only `MELP_UPGRADE_PLAN` postMessage and the relative `/spa/payment-page#plans` fallback are not used. |
| Bridge payload | None. The broadcast carries no extras; title and message stay in Jitsi. |
| Ended meeting | The popup shows a single OK. A room destroyed while "Meeting ended" is up is held back (`maybeDeferConferenceEnd`, up to 30 s) so the popup stays on screen; OK replays it. With nothing held back, OK runs the hangup button's exit: `NativeCallsNew.hangup()` (the client closes `MelpMeetSDk`) and then `leaveConference()`. The plans page is never opened. |
| Double taps / repeated signals | A ref absorbs a second tap until the popup opens again. The reducer replaces the one dialog state, so repeated signals never stack popups. A popup still up when its call goes away is cleared so it cannot greet the next call. |

## Parity pass against `androidjitsi_8615` branch `payment/IOS`

That branch (shallow clone, commit `e84860b`) has its own native capping. Adopted from it:

- **Server recording cap** and the **Melp Pad** gate (see the tables above).
- **Popup design:** its own card (grey outlined Remind me later, red Upgrade, OK only once the meeting has ended) instead of `react-native-dialog`, which uppercased and clipped the buttons and cut off the message on Android.
- **Plain-text duration signals only count from the room itself** (`consumeServerChatMessage`), so a participant typing "will end in" no longer opens the popup. Replayed room history is dropped without a popup, and `melp-usage` telemetry is kept out of chat.
- **`{ type: "meeting-ending" }` is a warning.** Before, "ending" contains "end" and it was read as the meeting having ended (web has the same bug).
- **A disabled zero-limit quota (`limit: 0, enabled: false`) is "not in your plan"**, with the unavailable popup.
- **Holding the room end** behind "Meeting ended", and **clearing a stale popup** when the call changes.

Kept different from that branch, on purpose:

| Topic | `payment/IOS` | Android here | Why |
| --- | --- | --- | --- |
| Upgrade | Opens `config.upgradePlansUrl` and notifies the host | Asks the Melp host to open its signed-in webview | The decision taken for Android; only the client has the session. |
| Poll button with `limit: 0` | Allowed unless `enabled: false` | Blocked, as on web | The brief requires the web rule. |
| Whiteboard not in plan | Popup for everyone | Popup for a moderator, participant closed silently | Web parity. |
| Popup state | `features/meeting-warning` reducer | `features/chat.meetingLimitDialog` | Same shape; kept where web has it. |

Not in that branch either: Jitsi9364's separate `live-translation` (dictation) feature is not capped anywhere, and the host API `START_RECORDING` path is not gated.

Client files changed: `app/.../melpapp/ApplicationController.java` (filter action), `xchat/.../helper/network/BroadcastEventReceiver.java` (routing and hook), `app/.../ui/activity/EventHandler.java` (opens the webview).

## Verification

| Check | Result |
| --- | --- |
| `tsc -p tsconfig.native.json` | 46 errors before and after the change; the sets are identical (no new errors). |
| `tsc -p tsconfig.web.json` (changed files) | Only the existing `chat/middleware.ts` `pushReactions` arity error, which predates this change. |
| ESLint on every changed and new file | Clean. |
| `npx jest` | 72 passed: 38 existing Piper tests plus 34 in `meeting-warning/__tests__/capping.test.ts` (signal detector, server-only and history handling, quota and access helpers, every middleware gate including remote and non-moderator pass-through, holding and releasing the room end, OK and Upgrade, both reducers). |
| Client compile | `./gradlew --offline :xchat:compileUatDebugJavaWithJavac :app:compileUatDebugJavaWithJavac` succeeded. The Jitsi SDK's `OpenMelpModule.java` was not compiled separately. |
| Device testing | Not done. |

Not done: no native component test for the popup (the jest setup is node-only and renders no React tree), no WebDriverIO or device run, and the SDK AAR was not rebuilt into the Maven repo the client uses.

## Risks and follow-ups

1. **The ended popup will not fire from the server's own text.** `mod_muc_call_limit` sends "Meeting duration reached. Ending call.", which matches none of the detector's ended patterns (web has the same gap; a unit test records it). The room is destroyed a second later, so the meeting just ends. Adding "duration reached" to `detectMeetingSignal` would fix both platforms, but changes shared behaviour, so it was left for a decision.
2. ~~Any chat message containing "will end in" opens the warning popup.~~ Fixed in the parity pass: plain text only counts from the room itself.
3. **The upgrade URL host is hardcoded to `uat.melp.us`** in the new client handler, like every existing capping entry point in the client. Production builds need the same fix everywhere.
4. **The SDK must be rebuilt** into the local Maven repo for the client to pick up the JS and Java changes.
5. **JWT contents not verified.** The sample token in `MainActivity.java` has no `features` claim. If Melp's Android meeting tokens also lack it, every gate allows everything.
6. **Guest upgrade policy** is undecided, as on web: guests get an Upgrade button during an active warning.
7. **The participant-count cap (`CONFERENCE_MAX_USERS`), the whiteboard user limit and recording-duration notifications** keep their own surfaces and were not touched.
8. **Security note on the supplied Lua:** `feature_counters_lua.pdf` contains a default export bearer token (`feature_counters_export_token`) in source. It should be moved to Prosody config and rotated.
