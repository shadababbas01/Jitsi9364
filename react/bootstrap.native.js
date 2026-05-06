// https://github.com/software-mansion/react-native-gesture-handler/issues/320#issuecomment-443815828
import 'react-native-gesture-handler';
import { NativeModules } from 'react-native';

// RN 0.72+ warns when NativeEventEmitter receives a native module without
// addListener/removeListeners. Some third-party native modules still omit them.
Object.keys(NativeModules).forEach(key => {
    const nativeModule = NativeModules[key];

    if (!nativeModule || typeof nativeModule !== 'object') {
        return;
    }
    if (typeof nativeModule.addListener !== 'function') {
        nativeModule.addListener = () => {};
    }
    if (typeof nativeModule.removeListeners !== 'function') {
        nativeModule.removeListeners = () => {};
    }
});

// Apply all necessary polyfills as early as possible to make sure anything imported henceforth
// sees them.
import 'react-native-get-random-values';
import './features/mobile/polyfills';
