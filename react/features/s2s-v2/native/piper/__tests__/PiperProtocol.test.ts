import {
    buildSynthesizeMessage,
    decodeAudioPayload,
    hasAdvertisedVoice,
    normalizeVoiceList,
    resolveVoiceId
} from '../PiperProtocol';

describe('normalizeVoiceList', () => {
    it('accepts a "languages" message of bare strings', () => {
        expect(normalizeVoiceList({ languages: [ 'en_US', 'hi_IN' ],
            type: 'languages' })).toEqual([
            { displayName: 'en_US', id: 'en_US' },
            { displayName: 'hi_IN', id: 'hi_IN' }
        ]);
    });

    it('accepts a "voices" message of objects with a display name', () => {
        expect(normalizeVoiceList({
            type: 'voices',
            voices: [
                { displayName: 'Hindi', id: 'hi_IN' },
                { displayName: 'English (US)', id: 'en_US' }
            ]
        })).toEqual([
            { displayName: 'English (US)', id: 'en_US' },
            { displayName: 'Hindi', id: 'hi_IN' }
        ]);
    });

    it('falls back to the id as a display name when one is not given', () => {
        expect(normalizeVoiceList({ languages: [ { id: 'pt_BR' } ] }))
            .toEqual([ { displayName: 'pt_BR', id: 'pt_BR' } ]);
    });

    it('ignores malformed entries rather than throwing', () => {
        expect(normalizeVoiceList({
            languages: [ 'en_US', null, 42, {}, { id: '' }, { id: '   ' } ]
        })).toEqual([ { displayName: 'en_US', id: 'en_US' } ]);
    });

    it('dedupes by id, case-insensitively, keeping the first entry seen', () => {
        expect(normalizeVoiceList({
            languages: [ 'en_US', 'EN_US', { displayName: 'English', id: 'en_us' } ]
        })).toEqual([ { displayName: 'en_US', id: 'en_US' } ]);
    });

    it('sorts by display name, falling back to id', () => {
        expect(normalizeVoiceList({
            languages: [
                { displayName: 'Hindi', id: 'hi_IN' },
                { displayName: 'Arabic', id: 'ar_SA' }
            ]
        })).toEqual([
            { displayName: 'Arabic', id: 'ar_SA' },
            { displayName: 'Hindi', id: 'hi_IN' }
        ]);
    });

    it('answers nothing for a message with neither field, or which is not an object', () => {
        expect(normalizeVoiceList({ type: 'session-start' })).toEqual([]);
        expect(normalizeVoiceList(null)).toEqual([]);
        expect(normalizeVoiceList('en_US')).toEqual([]);
    });

    it('accepts Melp\'s actual shape - an object keyed by an arbitrary numeric index, not an array', () => {
        expect(normalizeVoiceList({
            languages: {
                0: { id: 'en_US', placeholder: 'English' },
                1: { id: 'de_DE', placeholder: 'German' }
            },
            type: 'languages',
            user_id: 'unknown',
            user_name: 'unknown'
        })).toEqual([
            { displayName: 'English', id: 'en_US' },
            { displayName: 'German', id: 'de_DE' }
        ]);
    });

    it('reads the label from "placeholder", which is what Melp\'s service actually calls it', () => {
        expect(normalizeVoiceList({ languages: { 0: { id: 'en_US', placeholder: 'English' } } }))
            .toEqual([ { displayName: 'English', id: 'en_US' } ]);
    });
});

describe('resolveVoiceId', () => {
    const advertised = [
        { displayName: 'Portuguese (Brazil)', id: 'pt_BR' },
        { displayName: 'English (US)', id: 'en_US' }
    ];

    it('matches an exact id', () => {
        expect(resolveVoiceId('pt_BR', advertised)).toBe('pt_BR');
    });

    it('matches a base language when the exact id is not advertised', () => {
        expect(resolveVoiceId('pt', advertised)).toBe('pt_BR');
    });

    it('matches case-insensitively', () => {
        expect(resolveVoiceId('EN_us', advertised)).toBe('en_US');
    });

    it('strips a leading "translation-languages:" prefix before matching', () => {
        expect(resolveVoiceId('translation-languages:pt', advertised)).toBe('pt_BR');
    });

    it('matches a dash-separated locale against the underscored id the service advertises', () => {
        expect(resolveVoiceId('en-US', advertised)).toBe('en_US');
    });

    it('falls back to the requested value, normalized, when nothing matches', () => {
        expect(resolveVoiceId('fr_FR', advertised)).toBe('fr_fr');
    });

    it('falls back to the requested value when the advertised list is empty', () => {
        expect(resolveVoiceId('hi', [])).toBe('hi');
    });
});

describe('hasAdvertisedVoice', () => {
    const advertised = [ { displayName: 'Portuguese (Brazil)', id: 'pt_BR' } ];

    it('is true for an exact or base match', () => {
        expect(hasAdvertisedVoice('pt_BR', advertised)).toBe(true);
        expect(hasAdvertisedVoice('pt', advertised)).toBe(true);
    });

    it('is false when nothing matches, unlike resolveVoiceId it does not guess', () => {
        expect(hasAdvertisedVoice('fr', advertised)).toBe(false);
    });
});

describe('buildSynthesizeMessage', () => {
    it('builds exactly the three fields the protocol asks for', () => {
        expect(buildSynthesizeMessage('hello there', 'en_US')).toEqual({
            language: 'en_US',
            text: 'hello there',
            type: 'synthesize'
        });
    });

    it('trims the text before sending it', () => {
        expect(buildSynthesizeMessage('  hello  ', 'en_US')?.text).toBe('hello');
    });

    it('rejects blank text', () => {
        expect(buildSynthesizeMessage('', 'en_US')).toBeNull();
        expect(buildSynthesizeMessage('   ', 'en_US')).toBeNull();
    });
});

describe('decodeAudioPayload', () => {
    it('decodes a bare base64 payload, defaulting the format to wav', () => {
        expect(decodeAudioPayload({ data: 'AAAA' })).toEqual({ bytes: 'AAAA', format: 'wav' });
    });

    it('strips a data URL prefix', () => {
        expect(decodeAudioPayload({ data: 'data:audio/wav;base64,AAAA', format: 'wav' }))
            .toEqual({ bytes: 'AAAA', format: 'wav' });
    });

    it('keeps an explicit format', () => {
        expect(decodeAudioPayload({ data: 'AAAA', format: 'mp3' })).toEqual({ bytes: 'AAAA', format: 'mp3' });
    });

    it('rejects a missing payload', () => {
        expect(decodeAudioPayload({})).toBeNull();
        expect(decodeAudioPayload({ data: undefined })).toBeNull();
    });

    it('rejects an empty payload', () => {
        expect(decodeAudioPayload({ data: '' })).toBeNull();
    });

    it('rejects a payload which is not valid base64', () => {
        expect(decodeAudioPayload({ data: 'not base64 at all!!' })).toBeNull();
    });
});
