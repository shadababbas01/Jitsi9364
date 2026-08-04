declare const __DEV__: boolean;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // Side-effect imports for reducer + middleware registration.
    // eslint-disable-next-line global-require
    require('./reducer');
    // eslint-disable-next-line global-require
    require('./middleware');
}

export {};
