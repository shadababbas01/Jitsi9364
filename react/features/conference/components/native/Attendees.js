import React, { Component } from 'react';
import { View, Image, TouchableHighlight, FlatList } from 'react-native';
import styles, { ADD_ICON, BACK_ICON } from './styles';
import { ColorPalette } from '../../../base/styles/components/styles/ColorPalette';
import { connect } from 'react-redux';
import { getParticipants } from '../../../base/participants/functions';

import ParticipantItem from './ParticipantItem';

class Attendees extends Component {
    _hideAttendees = () => {
        this.props.showAttendees?.();
    };

    _renderItem = ({ item }) => {
        const { isTeamsCall } = this.props;
        return <ParticipantItem isTeamsCall={isTeamsCall} participant={item} />;
    };

    _renderItemSeperatorComponent = () => {
        return <View style={{ height: 10 }} />;
    };

    render() {
        const { participants = [], isTeamsCall } = this.props;
        return (
            <View style = { isTeamsCall? styles.attendeesTeamsContainer : styles.attendeesContainer }>
                <View style = { isTeamsCall ? styles.attendeesTeamsTopContainer : styles.attendeesTopContainer }>
                    <TouchableHighlight 
                    onPress={this._hideAttendees} 
                    underlayColor={ColorPalette.transparent}>
                        <Image source= { BACK_ICON  } style = { styles.backIconStyle } />
                    </TouchableHighlight>
                    <TouchableHighlight 
                    onPress={this._hideAttendees} 
                    underlayColor={ColorPalette.transparent}>
                        <Image source= { ADD_ICON } style = { styles.addIconStyle } />
                    </TouchableHighlight>
                </View>
                <FlatList
                    style = {styles.listContainerStyle}
                    data = {participants}
                    renderItem = {this._renderItem}
                    ItemSeparatorComponent = {this._renderItemSeperatorComponent}
                    keyExtractor={item => item?.id || String(Math.random())}
                />
            </View>
        );
    }
}

function _mapStateToProps(state) {
    const participantsMap = getParticipants(state);
    const participants = [];
    if (participantsMap && typeof participantsMap[Symbol.iterator] === 'function') {
        for (const [id, participant] of participantsMap) {
            participants.push(participant);
        }
    } else if (Array.isArray(participantsMap)) {
        participants.push(...participantsMap);
    }
    return {
        participants
    };
}

export default connect(_mapStateToProps)(Attendees);
