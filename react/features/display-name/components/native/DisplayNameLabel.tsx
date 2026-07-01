import * as React from 'react';
import { Text, TextStyle, View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import Icon from '../../../base/icons/components/Icon';
import { IconLaptop, IconMobile } from '../../../base/icons/svg';
import {
    getParticipantById,
    getParticipantDisplayName,
    isScreenShareParticipant
} from '../../../base/participants/functions';

import styles from './styles';

interface IProps {

    /**
     * The name of the participant to render.
     */
    _participantName: string;

    /**
     * True of the label needs to be rendered. False otherwise.
     */
    _render: boolean;

    /**
     * Whether or not the name is in a container.
     */
    contained?: boolean;

    /**
     * The device type of the participant ('web', 'android', 'ios').
     */
    deviceType?: string;

    /**
     * The ID of the participant to render the label for.
     */
    participantId: string;
}

/**
 * Renders a label with the display name of the on-stage participant.
 */
class DisplayNameLabel extends React.Component<IProps> {
    /**
     * Implements {@code Component#render}.
     *
     * @inheritdoc
     */
    override render() {
        if (!this.props._render) {
            return null;
        }

        const { _participantName, contained, deviceType } = this.props;

        let iconSrc;

        switch (deviceType) {
            case 'web':
                iconSrc = IconLaptop;
                break;
            case 'android':
            case 'ios':
                iconSrc = IconMobile;
                break;
            default:
                iconSrc = undefined;
                break;
        }

        return (
            <View
                style = { [
                    contained ? styles.displayNamePadding : styles.displayNameBackdrop,
                    { flexDirection: 'row', alignItems: 'center' }
                ] as ViewStyle }>
                <Text
                    numberOfLines = { 1 }
                    style = { styles.displayNameText as TextStyle }>
                    { _participantName }
                </Text>
                { deviceType && iconSrc && (
                    <Icon
                        size = { 14 }
                        src = { iconSrc }
                        style = {{ marginLeft: 6 }} />
                ) }
            </View>
        );
    }
}

/**
 * Maps part of the Redux state to the props of this component.
 *
 * @param {any} state - The Redux state.
 * @param {IProps} ownProps - The own props of the component.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, ownProps: Partial<IProps>) {
    const participant = getParticipantById(state, ownProps.participantId ?? '');

    return {
        _participantName: getParticipantDisplayName(state, ownProps.participantId ?? ''),
        _render: Boolean(participant && (!participant?.local || ownProps.contained)
            && (!participant?.fakeParticipant || isScreenShareParticipant(participant)))
    };
}

export default connect(_mapStateToProps)(DisplayNameLabel);
