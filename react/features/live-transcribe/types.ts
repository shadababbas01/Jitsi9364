/**
 * One stretch of speech captured from the local microphone, ready to be transcribed.
 */
export interface IUtterance {

    /**
     * The audio, Base64 encoded. WAV, mono, 16 kHz.
     */
    data: string;

    /**
     * How long the utterance lasts, in milliseconds.
     */
    durationMs: number;

    /**
     * The ID this utterance's caption is published under, generated locally so that the caption can be shown before the
     * service has answered and updated in place afterwards.
     */
    id: string;

    /**
     * The sample rate of the audio.
     */
    sampleRate: number;
}

/**
 * The event the native tap emits for each captured utterance. It carries no ID: that is added here, so that the native
 * side never has to know how captions are identified.
 */
export interface IUtteranceEvent {
    data: string;
    durationMs: number;
    sampleRate: number;
}
