import React from 'react';
import { DeviceEventEmitter, NativeModules, View, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { CHAT_ENABLED } from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import { translate } from '../../../base/i18n/functions';
import { IconMessage, IconMessageDot } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { arePollsDisabled } from '../../../conference/functions.any';
import { enterPictureInPicture } from '../../../mobile/picture-in-picture/actions';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';
import { getUnreadPollCount } from '../../../polls/functions';
import { getUnreadCount, getUnreadFilesCount, isChatDisabled } from '../../functions';

interface IProps extends AbstractButtonProps {

    /**
     * True if the polls feature is disabled.
     */
    _isPollsDisabled?: boolean;

    /**
     * The unread message count.
     */
    _unreadMessageCount: number;

    /**
     * Whether the chat screen is currently open.
     */
    _isChatOpen: boolean;
}

interface IState {
    _hasNativeNewMessage: boolean;
}

/**
 * Implements an {@link AbstractButton} to open the chat screen on mobile.
 */
class ChatButton extends AbstractButton<IProps, IState> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.chat';
    override icon = IconMessage;
    override label = 'toolbar.chat';
    override toggledIcon = IconMessageDot;

    state: IState = {
        _hasNativeNewMessage: false
    };

    _nativeNewMessageSubscription?: { remove?: () => void };

    override componentDidMount() {
        this._nativeNewMessageSubscription = DeviceEventEmitter.addListener('newMessage', (data: any = {}) => {
            if (typeof data?.newMessage === 'boolean') {
                this._setNativeNewMessage(data.newMessage);
                return;
            }

            const hasMessage = typeof data?.message === 'string' && data.message.length > 0;

            if (hasMessage) {
                this._setNativeNewMessage(true);
            }
        });
    }

    override componentDidUpdate(prevProps: IProps) {
        if (!prevProps._isChatOpen && this.props._isChatOpen) {
            this._setNativeNewMessage(false);
        }
    }

    override componentWillUnmount() {
        this._nativeNewMessageSubscription?.remove?.();
        this._nativeNewMessageSubscription = undefined;
    }

    _setNativeNewMessage(hasNewMessage: boolean) {
        if (this.state._hasNativeNewMessage !== hasNewMessage) {
            this.setState({ _hasNativeNewMessage: hasNewMessage });
        }
    }

    override render() {
        const hasUnread = Boolean(this.props._unreadMessageCount) || this.state._hasNativeNewMessage;
        const showUnreadDot = hasUnread
            && !this.props._isChatOpen
            && !this.props.showLabel;

        return (
            <View style = { unreadDotStyles.wrapper as ViewStyle }>
                { super.render() }
                {
                    showUnreadDot && (
                        <View
                            pointerEvents = 'none'
                            style = { unreadDotStyles.dot as ViewStyle } />
                    )
                }
            </View>
        );
    }

    /**
     * Handles clicking / pressing the button, and opens the appropriate dialog.
     *
     * @private
     * @returns {void}
     */
    override _handleClick() {
        this._setNativeNewMessage(false);
        // if (NativeModules?.NativeCallsNew?.OpenChat) {
            NativeModules.NativeCallsNew.OpenChat();
            // this.props.dispatch(enterPictureInPicture());
            // return;
        // }

        // this.props._isPollsDisabled
            // ? navigate(screen.conference.chat)
            // : navigate(screen.conference.chatTabs.main);

        // this.props.dispatch(enterPictureInPicture());
    }

    /**
     * Renders the button toggled when there are unread messages.
     *
     * @protected
     * @returns {boolean}
     */
    override _isToggled() {
        return Boolean(this.props._unreadMessageCount) || this.state._hasNativeNewMessage;
    }
}

/**
 * Maps part of the redux state to the component's props.
 *
 * @param {Object} state - The Redux state.
 * @param {Object} ownProps - The properties explicitly passed to the component instance.
 * @returns {IProps}
 */
function _mapStateToProps(state: IReduxState, ownProps: any) {
    const enabled = getFeatureFlag(state, CHAT_ENABLED, true) && !isChatDisabled(state);
    const { visible = enabled } = ownProps;

    return {
        _isChatOpen: Boolean(state['features/chat']?.isOpen),
        _isPollsDisabled: arePollsDisabled(state),
        _unreadMessageCount: getUnreadCount(state) || getUnreadPollCount(state) || getUnreadFilesCount(state),
        visible
    };
}

export default translate(connect(_mapStateToProps)(ChatButton));

const unreadDotStyles = {
    wrapper: {
        position: 'relative' as const
    },
    dot: {
        // backgroundColor: '#FF3B30',
        // borderColor: '#0B0B0C',
        // borderRadius: 4,
        // borderWidth: 1,
        // height: 8,
        // position: 'absolute' as const,
        // right: 6,
        // top: 6,
        // width: 8
    }
};
