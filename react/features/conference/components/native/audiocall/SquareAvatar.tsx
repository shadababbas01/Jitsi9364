import React from 'react';
import { useSelector } from 'react-redux';

import { IReduxState } from '../../../../app/types';
import StatelessAvatar from '../../../../base/avatar/components/native/StatelessAvatar';
import { getAvatarColor, getInitials } from '../../../../base/avatar/functions';
import { getParticipantById } from '../../../../base/participants/functions';

import styles from './styles';

interface IProps {

    /**
     * The name to fall back to (and to derive initials/color from) when there's no participant.
     */
    displayName?: string;

    /**
     * The id of the participant to render, if any.
     */
    participantId?: string;

    /**
     * The size of the avatar.
     */
    size: number;
}

/**
 * A rounded-square avatar (rather than the app's usual circular one), used on the audio call
 * screen. The shared, redux-connected `Avatar` component always clips to a circle internally and
 * has no way to override that, so this renders `StatelessAvatar` directly with just enough of
 * its own state (initials, color, photo URL) to reproduce the common cases.
 *
 * @param {IProps} props - The component's props.
 * @returns {JSX.Element}
 */
const SquareAvatar = ({ displayName, participantId, size }: IProps): JSX.Element => {
    const participant = useSelector(
        (state: IReduxState) => (participantId ? getParticipantById(state, participantId) : undefined));
    const customAvatarBackgrounds = useSelector(
        (state: IReduxState) => state['features/dynamic-branding'].avatarBackgrounds ?? []);

    const initialsBase = participant?.name ?? displayName;
    const initials = getInitials(initialsBase);
    const url = participant?.avatarURL ?? participant?.loadableAvatarUrl;

    return (
        <StatelessAvatar
            color = { url ? undefined : getAvatarColor(initials, customAvatarBackgrounds) }
            initials = { url ? undefined : initials }
            size = { size }
            style = { styles.squareAvatar }
            url = { url } />
    );
};

export default SquareAvatar;
