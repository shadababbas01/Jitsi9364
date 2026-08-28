import { IGroupableMessage } from '../base/util/messageGrouping';

export interface ITranscriptMessage {
    clearTimeOut?: number;
    final?: string;
    participant: {
        avatarUrl?: string;
        id?: string;
        name?: string;
    };
    stable?: string;
    unstable?: string;
}

export interface ISubtitle extends IGroupableMessage {
    id: string;
    interim?: boolean;
    isTranscription?: boolean;
    language?: string;
    participantAvatarUrl?: string;
    participantId: string;
    participantName?: string;

    /**
     * Which language this reader had chosen when the caption arrived.
     *
     * Frozen onto the caption rather than read live, so that changing language part way through a meeting leaves what
     * is already on screen alone and applies to what is said next. Re-translating the whole transcript underneath
     * somebody would rewrite a conversation they had already read, and would spend a request per line to do it.
     */
    readLanguage?: string;
    text: string;
    timestamp: number;
}
