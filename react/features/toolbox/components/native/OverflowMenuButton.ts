import React from 'react';
import { Animated, ViewStyle } from 'react-native';
import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { openSheet } from '../../../base/dialog/actions';
import { OVERFLOW_MENU_ENABLED } from '../../../base/flags/constants';
import { getFeatureFlag } from '../../../base/flags/functions';
import { translate } from '../../../base/i18n/functions';
import { IconDotsHorizontal } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { isLiveCaptionsActive } from '../../../subtitles/functions.any';
import { isVoiceTranslationEnabled } from '../../../voice-translation/functions';

import OverflowMenu from './OverflowMenu';

interface IProps extends AbstractButtonProps {
    _isLiveCaptionsActive: boolean;
    _isVoiceTranslationActive: boolean;
}

const activeWaveStyle: ViewStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0
};

/**
 * An implementation of a button for showing the {@code OverflowMenu}.
 */
class OverflowMenuButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.accessibilityLabel.moreActions';
    override icon = IconDotsHorizontal;
    override label = 'toolbar.moreActions';
    _waveAnimation?: Animated.CompositeAnimation;
    _waveProgress = new Animated.Value(0);

    override componentDidMount() {
        if (this._hasActiveFeature()) {
            this._startWave();
        }
    }

    override componentDidUpdate(prevProps: IProps) {
        const hadActiveFeature = prevProps._isLiveCaptionsActive || prevProps._isVoiceTranslationActive;
        const hasActiveFeature = this._hasActiveFeature();

        if (hadActiveFeature === hasActiveFeature) {
            return;
        }

        if (hasActiveFeature) {
            this._startWave();
        } else {
            this._stopWave();
        }
    }

    override componentWillUnmount() {
        this._stopWave();
    }

    /**
     * Handles clicking / pressing this {@code OverflowMenuButton}.
     *
     * @protected
     * @returns {void}
     */
    override _handleClick() {

        // @ts-ignore
        this.props.dispatch(openSheet(OverflowMenu));
    }

    override _getStyles() {
        const { styles } = this.props;

        if (!this._hasActiveFeature() || !styles) {
            return styles;
        }

        return {
            ...styles,
            style: {
                ...styles.style,
                position: 'relative'
            }
        };
    }

    override _getElementAfter() {
        if (!this._hasActiveFeature()) {
            return null;
        }

        return React.createElement(Animated.View, {
            pointerEvents: 'none',
            style: [
                activeWaveStyle,
                {
                    opacity: this._waveProgress.interpolate({
                        inputRange: [ 0, 0.35, 1 ],
                        outputRange: [ 0, 0.22, 0 ]
                    }),
                    transform: [ {
                        scale: this._waveProgress.interpolate({
                            inputRange: [ 0, 1 ],
                            outputRange: [ 0.15, 1 ]
                        })
                    } ]
                }
            ]
        });
    }

    override _isToggled() {
        return this._hasActiveFeature();
    }

    _hasActiveFeature() {
        return this.props._isLiveCaptionsActive || this.props._isVoiceTranslationActive;
    }

    _startWave() {
        if (this._waveAnimation) {
            return;
        }

        this._waveAnimation = Animated.loop(Animated.sequence([
            Animated.timing(this._waveProgress, {
                duration: 1200,
                toValue: 1,
                useNativeDriver: true
            }),
            Animated.timing(this._waveProgress, {
                duration: 250,
                toValue: 0,
                useNativeDriver: true
            })
        ]));

        this._waveAnimation.start();
    }

    _stopWave() {
        this._waveAnimation?.stop();
        this._waveAnimation = undefined;
        this._waveProgress.setValue(0);
    }
}

/**
 * Maps (parts of) the redux state to the associated props for the
 * {@code OverflowMenuButton} component.
 *
 * @param {Object} state - The Redux state.
 * @private
 * @returns {Props}
 */
function _mapStateToProps(state: IReduxState) {
    const enabledFlag = getFeatureFlag(state, OVERFLOW_MENU_ENABLED, true);

    return {
        _isLiveCaptionsActive: isLiveCaptionsActive(state),
        _isVoiceTranslationActive: isVoiceTranslationEnabled(state),
        visible: enabledFlag
    };
}

export default translate(connect(_mapStateToProps)(OverflowMenuButton));
