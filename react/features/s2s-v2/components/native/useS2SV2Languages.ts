import { useEffect, useState } from 'react';

import { ILiveCaptionsLanguage, fetchLiveCaptionsLanguages } from '../../../subtitles/languages';
import { S2S_V2_FALLBACK_LANGUAGE_CODES } from '../../constants';

/**
 * Asked for once and shared, since which languages the service handles does not change while the app is running.
 */
let request: Promise<ILiveCaptionsLanguage[]> | undefined;

/**
 * The resolved, sorted catalogue. A popup is replaced by the panel after the listener makes a selection; retaining the
 * result lets the panel render that selection on its first frame instead of briefly returning to an empty/loading list.
 */
let cachedLanguages: ILiveCaptionsLanguage[] = [];

/**
 * Returns the languages a session can be listened to in, sorted by what they are called, and empty until they are
 * known.
 *
 * The list is the translation service's, because that is the service which has to produce the text: a language it
 * cannot translate into leaves the listener with nothing to read and nothing to hear, whereas one the speech engine
 * has no voice for still shows a translated transcript and is warned about when it is chosen.
 *
 * @returns {ILiveCaptionsLanguage[]}
 */
export default function useS2SV2Languages(): ILiveCaptionsLanguage[] {
    const [ languages, setLanguages ] = useState<ILiveCaptionsLanguage[]>(cachedLanguages);

    useEffect(() => {
        let cancelled = false;

        request = request ?? fetchLiveCaptionsLanguages(S2S_V2_FALLBACK_LANGUAGE_CODES);

        request.then(fetched => {
            cachedLanguages = [ ...fetched ].sort((first, second) => first.label.localeCompare(second.label));

            if (!cancelled) {
                setLanguages(cachedLanguages);
            }
        });

        return () => {
            cancelled = true;
        };
    }, []);

    return languages;
}
