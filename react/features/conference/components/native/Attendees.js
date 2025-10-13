import React, { Component } from 'react';
import { View, Image, TouchableHighlight, FlatList } from 'react-native';
import styles, { ADD_ICON, BACK_ICON } from '../native/styles';
import { ColorPalette } from '../../../base/styles';
import { connect } from '../../../base/redux';
import { getParticipants } from '../../../base/participants';
import ParticipantItem from './ParticipantItem';

class Attendees extends Component {

    constructor(props){
        super(props);
        this._hideAttendees = this._hideAttendees.bind(this);
        this._renderItem = this._renderItem.bind(this);
        this._renderItemSeperatorComponent = this._renderItemSeperatorComponent.bind(this);
    }

    _hideAttendees(){
        this.props.showAttendees();
    }

    _renderItem({item, index, separators}){
        const { isTeamsCall } = this.props;
        return  <ParticipantItem isTeamsCall = {isTeamsCall} participant = {item}/>
    }

    _renderItemSeperatorComponent(){
        return <View style = {{height: 10}}/>
    }

    render() {
        const { participants, isTeamsCall } = this.props;
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
                    keyExtractor={item => item.id}
                />
            </View>
        );
    }
};

function _mapStateToProps(state){
    const participants = getParticipants(state);
    return {
        participants
    };
};

export default connect(_mapStateToProps)(Attendees);
