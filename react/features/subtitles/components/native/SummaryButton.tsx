import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideSheet, toggleDialog } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconInfo } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';

import SummarySetupDialog from './SummarySetupDialog';

interface IProps extends AbstractButtonProps {
    _summaryEnabled: boolean;
}

class SummaryButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.summarySettings';
    override icon = IconInfo;
    override label = 'toolbar.summary';
    override toggledAccessibilityLabel = 'toolbar.summarySettings';

    override _handleClick() {
        this.props.dispatch(hideSheet());
        this.props.dispatch(toggleDialog('SummarySetupDialog', SummarySetupDialog));
    }

    override _isToggled() {
        return this.props._summaryEnabled;
    }
}

function mapStateToProps(state: IReduxState) {
    return { _summaryEnabled: Boolean(state['features/subtitles']?._summaryEnabled) };
}

export default translate(connect(mapStateToProps)(SummaryButton));
