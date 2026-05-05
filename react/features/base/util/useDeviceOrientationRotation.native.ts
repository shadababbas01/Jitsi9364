import { useEffect, useState } from 'react';
import Orientation from 'react-native-orientation-locker';

const orientationToDegrees = (orientation: string = '') => {
    switch (orientation) {
    case 'LANDSCAPE-LEFT':
        return '90deg';
    case 'LANDSCAPE-RIGHT':
        return '-90deg';
    case 'PORTRAIT-UPSIDEDOWN':
        return '180deg';
    default:
        return '0deg';
    }
};

/**
 * Returns a rotate transform value aligned to the current device orientation.
 *
 * @returns {string}
 */
export function useDeviceOrientationRotation() {
    const [ rotation, setRotation ] = useState('0deg');

    useEffect(() => {
        const onOrientationChange = (orientation: string) => {
            setRotation(orientationToDegrees(orientation));
        };

        Orientation.getOrientation(onOrientationChange);
        Orientation.addOrientationListener(onOrientationChange);

        return () => Orientation.removeOrientationListener(onOrientationChange);
    }, []);

    return rotation;
}
