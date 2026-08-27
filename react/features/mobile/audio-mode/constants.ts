/**
 * The names the native audio mode module gives the routes it can put the call on.
 *
 * Plain strings rather than an enum because they cross the bridge in both directions: native decides what a route is
 * called, JS only ever repeats the name back to it.
 */
export const AUDIO_DEVICE_BLUETOOTH = 'BLUETOOTH';
export const AUDIO_DEVICE_CAR = 'CAR';
export const AUDIO_DEVICE_EARPIECE = 'EARPIECE';
export const AUDIO_DEVICE_HEADPHONES = 'HEADPHONES';
export const AUDIO_DEVICE_SPEAKER = 'SPEAKER';

/**
 * The routes which reach one person's ears rather than the room the phone is in.
 *
 * The distinction anything which moves the call to the loudspeaker on the user's behalf has to make: the earpiece is
 * the phone being held to an ear and is worth overriding, while a headset is somebody already listening privately and
 * is not - moving them to the loudspeaker would play the meeting to whoever is standing around them.
 */
export const PRIVATE_AUDIO_DEVICES = [ AUDIO_DEVICE_BLUETOOTH, AUDIO_DEVICE_CAR, AUDIO_DEVICE_HEADPHONES ];
