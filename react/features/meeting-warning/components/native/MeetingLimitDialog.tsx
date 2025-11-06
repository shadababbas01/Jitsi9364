import React from 'react';
import {
    Image,
    ImageSourcePropType,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

interface IProps {
    message?: string;
    onRemindLater: () => void;
    onUpgrade: () => void;
    title?: string;
    visible: boolean;
    imageSource?: ImageSourcePropType;
}

const DEFAULT_IMAGE = require('../../../../../images/callLimitImage.png');

const MeetingLimitDialog = ({
    message = 'This session will end in 15 minutes. Upgrade to continue without time restrictions.',
    onRemindLater,
    onUpgrade,
    title = 'Meeting ending soon',
    visible,
    imageSource = DEFAULT_IMAGE
}: IProps) => {
    return (
        <Modal
            animationType='fade'
            transparent = { true }
            visible = { visible }
            onRequestClose = { onRemindLater }>
            <View style = { styles.overlay }>
                <View style = { styles.container }>
                    <Image
                        source = { imageSource }
                        style = { styles.image }
                    />
                    <Text style = { styles.title }>
                        { title }
                    </Text>
                    <Text style = { styles.message }>
                        { message }
                    </Text>
                    <View style = { styles.actions }>
                        <TouchableOpacity
                            accessibilityRole = 'button'
                            onPress = { onRemindLater }
                            style = { [ styles.button, styles.secondaryButton, styles.buttonSpacing ] }>
                            <Text style = { [ styles.buttonText, styles.secondaryButtonText ] }>
                                REMIND ME LATER
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole = 'button'
                            onPress = { onUpgrade }
                            style = { [ styles.button, styles.primaryButton ] }>
                            <Text style = { [ styles.buttonText, styles.primaryButtonText ] }>
                                UPGRADE
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    actions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 24
    },
    buttonSpacing: {
        marginRight: 12
    },
    button: {
        alignItems: 'center',
        borderRadius: 6,
        flex: 1,
        paddingHorizontal: 12,
        paddingVertical: 12
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        maxWidth: 360,
        paddingHorizontal: 24,
        paddingVertical: 24
    },
    image: {
        borderRadius: 12,
        height: 140,
        marginBottom: 24,
        resizeMode: 'cover',
        width: '100%'
    },
    message: {
        color: '#4A4A4A',
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center'
    },
    overlay: {
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.54)',
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 16
    },
    primaryButton: {
        backgroundColor: '#EE4136'
    },
    primaryButtonText: {
        color: '#FFFFFF'
    },
    secondaryButton: {
        borderColor: '#554D4D',
        borderWidth: 1
    },
    secondaryButtonText: {
        color: '#554D4D'
    },
    title: {
        color: '#1A1A1A',
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center'
    }
});

export default MeetingLimitDialog;