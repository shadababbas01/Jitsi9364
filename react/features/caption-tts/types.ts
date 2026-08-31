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

/**
 * A voice the device speech engine can read a language in.
 *
 * The engine has several for most languages and picks one itself unless it is told which, which is what makes every
 * participant in a translated call come out sounding like the same person. See
 * {@link ../s2s-v2/native/voiceAssignment}.
 */
export interface ITtsVoice {

    /**
     * The region of the language the voice reads, e.g. {@code US}. Empty when the voice does not name one.
     */
    country: string;

    /**
     * The language the voice reads, as a BCP-47 tag, e.g. {@code en-US}.
     */
    locale: string;

    /**
     * How the engine identifies the voice, e.g. {@code en-us-x-tpf-network}. Opaque, and the only thing the engine
     * accepts a voice back as.
     */
    name: string;

    /**
     * Whether the voice has to be fetched to be used, which is what the good ones are.
     */
    networkRequired: boolean;

    /**
     * Whether the engine advertises the voice but does not have it. Reported rather than left out, so that a caller
     * spreading speakers across the voices knows the voice exists and cannot be used.
     */
    notInstalled: boolean;

    /**
     * How good the engine says the voice is, on its own scale.
     */
    quality: number;
}
