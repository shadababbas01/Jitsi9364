import { useEffect, useState } from 'react';

import {
    ILiveCaptionsLanguage,
    fetchLiveCaptionsLanguages
} from '../../../subtitles/languages';

/**
 * The languages to fall back on while the list is being fetched, or if fetching it fails.
 */
const FALLBACK_CODES = [ 'en', 'hi', 'es', 'fr', 'de', 'ar', 'zh', 'ja', 'pt', 'ru' ];

/**
 * The list, once it has been asked for.
 *
 * Which languages the service can translate into does not change while the app is running, and two controls in this
 * feature ask about them - the language sheet and the invitation which says how many there are - so the answer is
 * fetched once and shared rather than fetched by whoever happens to be mounted.
 */
let request: Promise<ILiveCaptionsLanguage[]> | undefined;

/**
 * Returns the languages a call can be translated into, empty until they are known.
 *
 * @returns {ILiveCaptionsLanguage[]}
 */
export default function useCaptionLanguages(): ILiveCaptionsLanguage[] {
    const [ languages, setLanguages ] = useState<ILiveCaptionsLanguage[]>([]);

    useEffect(() => {
        let cancelled = false;

        request = request ?? fetchLiveCaptionsLanguages(FALLBACK_CODES);

        request.then(fetched => {
            if (!cancelled) {
                setLanguages(fetched);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return languages;
}
