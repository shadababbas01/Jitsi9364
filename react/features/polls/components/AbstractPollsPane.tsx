import React, { ComponentType, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';

import { IReduxState } from '../../app/types';
import { checkFeatureUsage, hardLimitDialog, toPositiveInt } from '../../meeting-warning/functions';

/*
 * Props that will be passed by the AbstractPollsPane to its
 * concrete implementations (web/native).
 **/
export type AbstractProps = {
    createMode: boolean;
    onCreate: () => void;
    setCreateMode: (mode: boolean) => void;
    t: Function;
};

/**
 * Higher Order Component taking in a concrete PollsPane component and
 * augmenting it with state/behavior common to both web and native implementations.
 *
 * @param {React.AbstractComponent} Component - The concrete component.
 * @returns {React.AbstractComponent}
 */
const AbstractPollsPane = (Component: ComponentType<AbstractProps>) => () => {

    const dispatch = useDispatch();
    const pollFeatureLimit = useSelector((state: IReduxState) =>
        state['features/base/jwt']?.featureUsageLimits?.polls);
    const [ createMode, setCreateMode ] = useState(false);

    const onCreate = () => {
        // The plan's poll quota is checked here, before anything is typed: used up, or not in the plan.
        if (!dispatch(checkFeatureUsage('polls'))) {
            return;
        }

        // Unlike the generic gate, and as on web, any other limit of 0 also means the plan has no polls left.
        if (pollFeatureLimit && toPositiveInt(pollFeatureLimit.limit) === 0) {
            dispatch(hardLimitDialog('polls', 0));

            return;
        }

        setCreateMode(true);
    };

    const { t } = useTranslation();

    return (<Component
        createMode = { createMode }
        /* eslint-disable react/jsx-no-bind */
        onCreate = { onCreate }
        setCreateMode = { setCreateMode }
        t = { t } />);

};

export default AbstractPollsPane;
