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
     * The ID of the participant to render the label for.
     */
    participantId: string;

    deviceType?: string;
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

    render() {
        if (!this.props._render) {
            return null;
        }

        const { _participantName, contained, deviceType } = this.props;

        let iconSrc;

        console.log(_participantName, deviceType, 'lakshay added this');

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
                style={[
                    contained ? styles.displayNamePadding : styles.displayNameBackdrop,
                    { flexDirection: 'row', alignItems: 'center' }
                ] as unknown as ViewStyle}>
                <Text
                    numberOfLines={1}
                    style={styles.displayNameText as TextStyle}>
                    {_participantName}
                </Text>

                {deviceType && iconSrc && (
                    <Icon
                        src={iconSrc}
                        size={14}
                        style={{ marginLeft: 6 }} // spacing between text and icon
                    />
                )}
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
