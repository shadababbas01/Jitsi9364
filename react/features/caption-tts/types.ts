/**
 * A language the speech service can synthesize. The service routes by language rather than by voice: it decides which
 * engine and which voice to use itself, so a language is all a caller ever gets to pick.
 */
export interface ITtsLanguage {

    /**
     * The ID to ask the service for, e.g. {@code en_US}.
     */
    id: string;

    /**
     * How the service names the language, e.g. {@code English}.
     */
    placeholder: string;
}

/**
 * Audio returned by the speech service.
 */
export interface ISynthesizedAudio {

    /**
     * The audio, Base64 encoded.
     */
    data: string;

    /**
     * The audio container, e.g. {@code wav}.
     */
    format: string;

    /**
     * The sample rate of the audio. It varies with the engine the service picked for the language, so it is read from
     * the response rather than assumed. Informational here, since the WAV header carries it for the player too.
     */
    sampleRate?: number;
}
