import { connect } from 'react-redux';

import AbstractButton, { IProps as AbstractButtonProps } from '../../../base/toolbox/components/AbstractButton';
import { IReduxState } from '../../../app/types';
import { IconHighlight } from '../../../base/icons/svg';
import { translate } from '../../../base/i18n/functions';
import { navigate } from '../../../mobile/navigation/components/conference/ConferenceNavigationContainerRef';
import { screen } from '../../../mobile/navigation/routes';

class SummarySettingsButton extends AbstractButton<AbstractButtonProps> {
    accessibilityLabel = 'summarySetup.title';
    icon = IconHighlight;
    label = 'summarySetup.title';

    _handleClick() {
        return navigate(screen.conference.summary);
    }
}

function mapStateToProps(state: IReduxState) {
    const aiSummary = state['features/base/config']?.aiSummary;

    return {
        visible: aiSummary?.enabled ?? true
    };
}

export default translate(connect(mapStateToProps)(SummarySettingsButton));