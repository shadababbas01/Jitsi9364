import { createContext } from 'react';

/**
 * Whether the local participant is dictating a message right now. The console owns the microphone and the stage above it
 * has to show the local avatar speaking, so the flag is shared through the screen rather than lifted into redux: it is
 * of no interest to anything outside this screen.
 */
export const ChatCallContext = createContext<{
    dictating: boolean;
    setDictating: (dictating: boolean) => void;
}>({
            dictating: false,
            setDictating: () => { /* No provider: nothing to record. */ }
        });
