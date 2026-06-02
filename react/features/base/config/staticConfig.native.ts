import { IConfig } from './configType';

let STATIC_CONFIG: IConfig | undefined;

export function getStaticConfig(): IConfig | undefined {
    return STATIC_CONFIG ? JSON.parse(JSON.stringify(STATIC_CONFIG)) : undefined;
}

export function setStaticConfig(config: IConfig) {
    STATIC_CONFIG = JSON.parse(JSON.stringify(config));
}
