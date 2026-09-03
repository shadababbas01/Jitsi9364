import { INITIAL_LANGUAGES_GRACE_MS, S2S_V2_TTS_URL, SYNTHESIS_TIMEOUT_MS, TTS_RECONNECT_DELAY_MS } from '../../../constants';
import PiperTtsClient from '../PiperTtsClient';

jest.mock('../../../logger', () => ({
    __esModule: true,
    default: {
        debug: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn()
    }
}));

let instances: FakeWebSocket[];

/**
 * A websocket a test can drive by hand: nothing here talks to a network, it only records what was sent and lets a
 * test decide when it "opens", "receives" a frame, or "closes".
 */
class FakeWebSocket {
    static CLOSED = 3;
    static CONNECTING = 0;
    static OPEN = 1;

    onclose: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onmessage: ((event: { data: string; }) => void) | null = null;
    onopen: (() => void) | null = null;
    readyState = FakeWebSocket.CONNECTING;
    sent: string[] = [];
    url: string;

    constructor(url: string) {
        this.url = url;
        instances.push(this);
    }

    close() {
        this.readyState = FakeWebSocket.CLOSED;
    }

    open() {
        this.readyState = FakeWebSocket.OPEN;
        this.onopen?.();
    }

    receive(message: unknown) {
        this.onmessage?.({ data: JSON.stringify(message) });
    }

    send(data: string) {
        this.sent.push(data);
    }
}

function makeClient(jwt: string | undefined = 'test-jwt') {
    return new PiperTtsClient({
        getState: () => ({ 'features/base/jwt': { jwt } }) as any,
        webSocketImpl: FakeWebSocket as any
    });
}

/**
 * Opens a fake socket and immediately has the service advertise a voice list on it, the way a real Piper connection
 * is expected to behave. Most tests do not care about the grace period itself, only about what happens once a
 * connection is usable - this gets them there in one step.
 *
 * @param {FakeWebSocket} socket - The socket to open.
 * @param {Array<unknown>} voices - The voice list the fake service advertises.
 * @returns {void}
 */
function openWithVoices(socket: FakeWebSocket, voices: unknown[] = [ 'en_US' ]) {
    socket.open();
    socket.receive({ type: 'voices', voices });
}

function sentMessage(socket: FakeWebSocket, index = 0): { language: string; text: string; } {
    return JSON.parse(socket.sent[index]);
}

beforeEach(() => {
    instances = [];
    jest.useFakeTimers();
});

afterEach(() => {
    jest.useRealTimers();
});

it('queues a request made before connecting, and sends it once the socket opens', () => {
    const client = makeClient();

    const request = client.synthesize('hello', 'en_US');

    expect(instances).toHaveLength(0);

    client.connect();
    expect(instances).toHaveLength(1);
    expect(instances[0].sent).toHaveLength(0);

    openWithVoices(instances[0]);
    expect(instances[0].sent).toHaveLength(1);
    expect(sentMessage(instances[0]).text).toBe('hello');

    instances[0].receive({ data: 'AAAA', format: 'wav', type: 'audio' });

    return expect(request).resolves.toEqual({ bytes: 'AAAA', format: 'wav' });
});

it('sends only one request at a time, since the service attaches no id a reply could be matched back by', async () => {
    const client = makeClient();

    client.connect();
    openWithVoices(instances[0]);

    const first = client.synthesize('first', 'en_US');
    const second = client.synthesize('second', 'en_US');

    // "second" must not go out yet - the service would have no way to say which of two in-flight replies answers
    // which request.
    expect(instances[0].sent).toHaveLength(1);
    expect(sentMessage(instances[0]).text).toBe('first');

    instances[0].receive({ data: 'AAAA', format: 'wav', type: 'audio' });
    await expect(first).resolves.toEqual({ bytes: 'AAAA', format: 'wav' });

    // Sent the moment the first was answered, not before.
    expect(instances[0].sent).toHaveLength(2);
    expect(sentMessage(instances[0], 1).text).toBe('second');

    instances[0].receive({ data: 'BBBB', format: 'wav', type: 'audio' });
    await expect(second).resolves.toEqual({ bytes: 'BBBB', format: 'wav' });
});

it('completes the oldest pending request as failed on an error reply, without blocking the next one', async () => {
    const client = makeClient();

    client.connect();
    openWithVoices(instances[0]);

    const first = client.synthesize('first', 'en_US');

    instances[0].receive({ message: 'no voice for that language', type: 'error' });
    await expect(first).rejects.toThrow('no voice for that language');

    const second = client.synthesize('second', 'en_US');

    instances[0].receive({ data: 'AAAA', format: 'wav', type: 'audio' });
    await expect(second).resolves.toEqual({ bytes: 'AAAA', format: 'wav' });
});

it('rejects a request which the service never answers, and reconnects rather than waiting forever', async () => {
    const client = makeClient();

    client.connect();
    openWithVoices(instances[0]);

    const request = client.synthesize('hello', 'en_US');

    jest.advanceTimersByTime(SYNTHESIS_TIMEOUT_MS);

    await expect(request).rejects.toThrow('did not answer in time');

    // A reply which arrived after this would be attributed to whatever is sent next, so the connection was recycled
    // rather than kept.
    expect(instances[0].readyState).toBe(FakeWebSocket.CLOSED);
    expect(instances).toHaveLength(2);
});

it('requeues a request which was in flight when the connection drops ahead of anything not yet sent', () => {
    const client = makeClient();

    client.connect();
    openWithVoices(instances[0]);

    client.synthesize('first', 'en_US');
    expect(instances[0].sent).toHaveLength(1);

    // The connection drops with "first" still unanswered.
    instances[0].onclose?.();

    // Asked for while there is nowhere to send it yet - it waits behind "first", not in front of it.
    client.synthesize('second', 'en_US');

    jest.advanceTimersByTime(TTS_RECONNECT_DELAY_MS);

    expect(instances).toHaveLength(2);

    // The voice list is already known from the first connection, so the reconnect does not wait out a second grace
    // period before sending what was waiting.
    instances[1].open();

    expect(instances[1].sent).toHaveLength(1);
    expect(sentMessage(instances[1]).text).toBe('first');

    // "second" only goes out once "first" - resent on the new connection - has been answered.
    instances[1].receive({ data: 'AAAA', format: 'wav', type: 'audio' });

    expect(instances[1].sent).toHaveLength(2);
    expect(sentMessage(instances[1], 1).text).toBe('second');
});

it('connects even without a JWT, since the service decides for itself whether one is required', () => {
    const client = makeClient('');

    client.connect();
    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe(S2S_V2_TTS_URL);
});

it('appends the JWT as a token query parameter when one is available', () => {
    const client = makeClient('a jwt with characters to encode/here');

    client.connect();
    expect(instances[0].url)
        .toBe(`${S2S_V2_TTS_URL}?token=${encodeURIComponent('a jwt with characters to encode/here')}`);
});

it('rejects everything queued and pending, and stops retrying, once told to disconnect', async () => {
    const client = makeClient();

    client.connect();
    openWithVoices(instances[0]);

    const pending = client.synthesize('sent already', 'en_US');

    // So the next request stays queued instead of also going out immediately.
    instances[0].readyState = FakeWebSocket.CONNECTING;

    const queued = client.synthesize('never sent', 'en_US');

    client.disconnect();

    await expect(pending).rejects.toThrow('closed');
    await expect(queued).rejects.toThrow('closed');

    jest.advanceTimersByTime(TTS_RECONNECT_DELAY_MS * 10);
    expect(instances).toHaveLength(1);
});

describe('resolving a voice against the service\'s advertised list', () => {
    it('holds the first batch until the voice list arrives, rather than guessing at connect time', () => {
        const client = makeClient();

        client.connect();
        instances[0].open();

        // Asked for before the service has said what it can speak - the bare code must not go out as-is.
        const request = client.synthesize('hello', 'en');

        expect(instances[0].sent).toHaveLength(0);

        instances[0].receive({
            type: 'voices',
            voices: [ { displayName: 'English (US)', id: 'en_US' } ]
        });

        expect(instances[0].sent).toHaveLength(1);
        expect(sentMessage(instances[0]).language).toBe('en_US');

        instances[0].receive({ data: 'AAAA', format: 'wav', type: 'audio' });

        return expect(request).resolves.toEqual({ bytes: 'AAAA', format: 'wav' });
    });

    it('sends anyway once the grace period elapses, if the service never advertises a list', () => {
        const client = makeClient();

        client.connect();
        instances[0].open();

        client.synthesize('hello', 'en');
        expect(instances[0].sent).toHaveLength(0);

        jest.advanceTimersByTime(INITIAL_LANGUAGES_GRACE_MS);

        expect(instances[0].sent).toHaveLength(1);
        expect(sentMessage(instances[0]).language).toBe('en');
    });

    it('does not wait a second time on a later connection once the list is already known', () => {
        const client = makeClient();

        client.connect();
        openWithVoices(instances[0], [ { displayName: 'English (US)', id: 'en_US' } ]);

        instances[0].onclose?.();
        jest.advanceTimersByTime(TTS_RECONNECT_DELAY_MS);

        instances[1].open();

        const request = client.synthesize('hello', 'en');

        // No grace period this time: the list from the first connection is still the client's, so a request made
        // right after this second connection opens goes out immediately.
        expect(instances[1].sent).toHaveLength(1);
        expect(sentMessage(instances[1]).language).toBe('en_US');

        instances[1].receive({ data: 'AAAA', format: 'wav', type: 'audio' });

        return expect(request).resolves.toEqual({ bytes: 'AAAA', format: 'wav' });
    });
});
