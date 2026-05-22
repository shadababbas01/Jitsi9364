import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { setVoiceTranslationPopupVisible } from '../../actions';

/**
 * Opens the native voice translation panel when a remote voice translation
 * event asks the local user for consent/preferences.
 *
 * @returns {null}
 */
export default function VoiceTranslationAutoOpen() {
    const dispatch = useDispatch();
    const shouldOpen = useSelector((state: IReduxState) =>
        Boolean(state['features/voice-translation']?.showPreferencesPopup));

    useEffect(() => {
        if (!shouldOpen) {
            return;
        }

        navigate(screen.conference.voiceTranslation);
        dispatch(setVoiceTranslationPopupVisible(false));
    }, [ dispatch, shouldOpen ]);

    return null;
}
