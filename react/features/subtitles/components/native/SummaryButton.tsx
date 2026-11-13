import { connect } from 'react-redux';

import { IReduxState } from '../../../app/types';
import { hideSheet, toggleDialog } from '../../../base/dialog/actions';
import { translate } from '../../../base/i18n/functions';
import { IconShareDoc } from '../../../base/icons/svg';
import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { canShowGenerateSummary } from '../../summary';

import SummarySetupDialog from './SummarySetupDialog';

interface IProps extends AbstractButtonProps {
    _summaryEnabled: boolean;
}

class SummaryButton extends AbstractButton<IProps> {
    override accessibilityLabel = 'toolbar.summarySettings';
    override icon = IconShareDoc;
    override label = 'toolbar.summary';
    override toggledAccessibilityLabel = 'toolbar.summarySettings';
    override toggledLabel = 'toolbar.summarySettings';

    override _handleClick() {
        this.props.dispatch(hideSheet());
        this.props.dispatch(toggleDialog('SummarySetupDialog', SummarySetupDialog));
    }

    override _isToggled() {
        return this.props._summaryEnabled;
    }
}

function mapStateToProps(state: IReduxState) {
    return {
        _summaryEnabled: Boolean(state['features/subtitles']?._summaryEnabled),
        visible: canShowGenerateSummary(state)
    };
}

export default translate(connect(mapStateToProps)(SummaryButton));
