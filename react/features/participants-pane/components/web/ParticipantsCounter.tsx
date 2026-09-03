import React from 'react';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';

import { getParticipantCountForDisplay } from '../../../base/participants/functions';

const useStyles = makeStyles()(theme => {
    return {
        badge: {
            alignItems: 'center',
            backgroundColor: theme.palette.ui03,
            borderRadius: '100%',
            boxSizing: 'border-box',
            display: 'flex',
            height: '16px',
            justifyContent: 'center',
            minWidth: '16px',
            color: theme.palette.text01,
            ...theme.typography.labelBold,
            pointerEvents: 'none',
            position: 'absolute',
            right: '-4px',
            top: '-3px',
            padding: '1px'
        }
    };
});

const ParticipantsCounter = () => {
    const { classes } = useStyles();
    const participantsCount = useSelector(getParticipantCountForDisplay);

    return <span className = { classes.badge }>{participantsCount}</span>;
};

export default ParticipantsCounter;
