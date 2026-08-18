/**
 * How much of the screen the live translation panel takes, in the same way the live captions panel does, so that the two
 * feel like the same kind of thing sitting under the video.
 */
export const LIVE_TRANSLATION_PANEL_HEIGHT_RATIO = 0.34;

/**
 * The least room the panel gets, whatever the screen height. Enough for a row of avatars, the state line and the
 * controls underneath them.
 */
export const LIVE_TRANSLATION_PANEL_MIN_HEIGHT = 220;

/**
 * How much room the panel leaves at its bottom while the meeting toolbar is on screen, so its own controls are not
 * underneath it. The live captions panel reserves the same.
 */
export const LIVE_TRANSLATION_TOOLBAR_RESERVE = 72;

/**
 * The presence property the state of the microphone is announced through.
 *
 * A translated call keeps the conference microphone muted from beginning to end, whatever the local user has their own
 * microphone set to, so what the meeting can see of their audio track says nothing about whether they are talking. This
 * is what says it instead, and it is sent for as long as the call runs.
 */
export const LIVE_TRANSLATION_MIC_PROPERTY = 'liveTranslationMic';

/**
 * The value of {@link LIVE_TRANSLATION_MIC_PROPERTY} for an open microphone.
 */
export const LIVE_TRANSLATION_MIC_ON = 'on';

/**
 * The value of {@link LIVE_TRANSLATION_MIC_PROPERTY} for a closed one.
 */
export const LIVE_TRANSLATION_MIC_OFF = 'off';

/**
 * The value of {@link LIVE_TRANSLATION_MIC_PROPERTY} for somebody who is not in a translated call at all, and whose
 * audio track therefore means exactly what it says.
 */
export const LIVE_TRANSLATION_MIC_NONE = '';

/**
 * The presence property the recorder's speech state is announced through.
 *
 * For the same reason the microphone has to be announced: with the conference microphone muted no audio level ever
 * leaves the device, so nothing the meeting can see says who is talking. This is what the speaking outline on everybody
 * else's copy of the tile is drawn from.
 */
export const LIVE_TRANSLATION_SPEAKING_PROPERTY = 'liveTranslationSpeaking';

/**
 * The value of {@link LIVE_TRANSLATION_SPEAKING_PROPERTY} while the recorder is hearing the participant.
 */
export const LIVE_TRANSLATION_SPEAKING_ON = 'on';

/**
 * The value of {@link LIVE_TRANSLATION_SPEAKING_PROPERTY} the rest of the time, including outside a translated call.
 */
export const LIVE_TRANSLATION_SPEAKING_OFF = 'off';

/**
 * The endpoint message channel invitations travel on. A translated call is only worth anything if the other side is in
 * it too - one person talking into a transcriber while everybody else talks normally helps nobody - so turning it on
 * asks the rest of the meeting to come along.
 */
export const LIVE_TRANSLATION_ENDPOINT = 'melp-live-translation';

/**
 * Somebody turned a translated call on and is asking the meeting to join it.
 */
export const LIVE_TRANSLATION_INVITE = 'invite';

/**
 * The inviter turned their call off before anybody answered, so a prompt still on screen is asking about nothing.
 */
export const LIVE_TRANSLATION_INVITE_WITHDRAWN = 'invite-withdrawn';

/**
 * The answers to an invitation, so the inviter learns whether anybody came.
 */
export const LIVE_TRANSLATION_INVITE_ACCEPTED = 'invite-accepted';
export const LIVE_TRANSLATION_INVITE_DECLINED = 'invite-declined';

/**
 * How long a pause ends an utterance and sends it off to be transcribed.
 */
export const SILENCE_MS = 1000;

/**
 * The longest the recorder waits for a pause before handing an utterance over anyway, so that a monologue is still
 * transcribed as it goes rather than at the end.
 */
export const MAX_UTTERANCE_MS = 20 * 1000;

/**
 * How long to wait for the transcription service. Longer than the caption default because a whole utterance is a bigger
 * upload than a fixed caption window.
 */
export const TRANSCRIBE_TIMEOUT_MS = 60 * 1000;

/**
 * How loud the other participants' own voices are left while the translation panel is on screen, as a share of the
 * volume they would otherwise be heard at.
 *
 * Everything they say arrives a second time on a translated call: transcribed, translated and read out loud, and the
 * reading is the part the local user is there for. Their untranslated voices are turned down to a murmur rather than off
 * altogether, so it is still audible who is talking and when they have finished.
 */
export const REMOTE_AUDIO_DUCK_GAIN = 0.05;

/**
 * The volume a remote participant is heard at when the local user has never said otherwise, in the units
 * {@link REMOTE_AUDIO_DUCK_GAIN} is in. What their voice goes back to when the panel is closed.
 */
export const REMOTE_AUDIO_DEFAULT_GAIN = 1;

/**
 * When the volume is set again after a participant's audio track has been turned down.
 *
 * A track which has only just been added is not playing yet, and a volume set on a sink which does not exist is
 * forgotten rather than remembered for later. Setting it again once the audio has started is what makes it stick.
 */
export const REMOTE_AUDIO_DUCK_RETRIES_MS = [ 1000, 3000 ];

/**
 * How long the microphone stays deaf after the device has stopped speaking. A room reverberates, and the last syllable
 * out of the loudspeaker is still in the air after the engine reports it done.
 */
export const ECHO_TAIL_MS = 400;
