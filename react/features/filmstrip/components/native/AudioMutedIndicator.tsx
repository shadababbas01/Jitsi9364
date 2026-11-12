import React from 'react';

import { IconMicSlash } from '../../../base/icons/svg';
import BaseIndicator from '../../../base/react/components/native/BaseIndicator';

/**
 * Thumbnail badge showing that the participant's microphone is muted.
 *
 * @returns {JSX.Element}
 */
const AudioMutedIndicator = (): JSX.Element => <BaseIndicator icon = { IconMicSlash } />;

export default AudioMutedIndicator;
