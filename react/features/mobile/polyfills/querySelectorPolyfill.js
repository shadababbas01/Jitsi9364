function getElementChildren(node) {
    if (!node) {
        return [];
    }

    const children = [];
    const nodes = node.childNodes || [];

    for (let i = 0; i < nodes.length; i += 1) {
        const child = nodes[i];
        if (child && child.nodeType === 1) {
            children.push(child);
        }
    }

    return children;
}

function getElementDescendants(node) {
    const results = [];
    const stack = getElementChildren(node);

    for (let i = 0; i < stack.length; i += 1) {
        const el = stack[i];
        results.push(el);
        const children = getElementChildren(el);
        for (let j = 0; j < children.length; j += 1) {
            stack.push(children[j]);
        }
    }

    return results;
}

function getAttributeValue(el, attrName) {
    if (!el || !attrName) {
        return null;
    }

    const localName = attrName.includes('|') ? attrName.split('|')[1] : attrName;

    let value = el.getAttribute?.(localName);
    if (value != null) {
        return value;
    }

    const attrs = el.attributes || [];
    for (let i = 0; i < attrs.length; i += 1) {
        const attr = attrs[i];
        if (!attr) {
            continue;
        }
        const name = attr.name || '';
        if (name === localName || name.endsWith(`:${localName}`)) {
            return attr.value;
        }
    }

    return null;
}

function parseSimpleSelector(simple) {
    const selector = simple.trim();
    const attrs = [];
    let tag = selector;

    const bracketIndex = selector.indexOf('[');
    if (bracketIndex !== -1) {
        tag = selector.slice(0, bracketIndex).trim();
        const rest = selector.slice(bracketIndex);
        const attrRegex = /\[([^\]=]+)(?:=(\"[^\"]*\"|'[^']*'|[^\]]+))?\]/g;
        let match;

        while ((match = attrRegex.exec(rest))) {
            let value = null;
            if (match[2] !== undefined) {
                value = match[2].trim();
                if ((value.startsWith('"') && value.endsWith('"'))
                    || (value.startsWith('\'') && value.endsWith('\''))) {
                    value = value.slice(1, -1);
                }
            }
            attrs.push({
                name: match[1].trim(),
                value
            });
        }
    }

    if (!tag) {
        tag = '*';
    }

    return { tag, attrs };
}

function matchesSimpleSelector(element, simple) {
    if (!element || element.nodeType !== 1) {
        return false;
    }

    const { tag, attrs } = parseSimpleSelector(simple);

    if (tag !== '*' && tag !== '' && element.tagName !== tag) {
        return false;
    }

    for (let i = 0; i < attrs.length; i += 1) {
        const { name, value } = attrs[i];
        const actual = getAttributeValue(element, name);
        if (actual == null) {
            return false;
        }
        if (value !== null && actual !== value) {
            return false;
        }
    }

    return true;
}

function tokenizeSelector(selector) {
    let s = selector.trim();
    let leadingCombinator = null;

    if (s.startsWith(':scope')) {
        s = s.slice(6);
        if (s.startsWith('>')) {
            leadingCombinator = '>';
            s = s.slice(1);
        } else if (/^\s/.test(s)) {
            leadingCombinator = ' ';
            s = s.replace(/^\s+/, '');
        } else {
            leadingCombinator = 'self';
        }
    }

    s = s.trim();

    const tokens = [];
    let buf = '';
    let combinator = null;
    let inBracket = false;
    let inQuote = null;

    for (let i = 0; i < s.length; i += 1) {
        const ch = s[i];

        if (inQuote) {
            if (ch === inQuote) {
                inQuote = null;
            }
            buf += ch;
            continue;
        }

        if (ch === '"' || ch === '\'') {
            inQuote = ch;
            buf += ch;
            continue;
        }

        if (ch === '[') {
            inBracket = true;
            buf += ch;
            continue;
        }

        if (ch === ']') {
            inBracket = false;
            buf += ch;
            continue;
        }

        if (!inBracket && (ch === '>' || /\s/.test(ch))) {
            if (buf.trim().length > 0) {
                tokens.push({ selector: buf.trim(), combinator });
                buf = '';
            }
            combinator = ch === '>' ? '>' : ' ';
            while (i + 1 < s.length && /\s/.test(s[i + 1])) {
                i += 1;
            }
            continue;
        }

        buf += ch;
    }

    if (buf.trim().length > 0) {
        tokens.push({ selector: buf.trim(), combinator });
    }

    if (tokens.length > 0) {
        if (leadingCombinator && leadingCombinator !== 'self') {
            tokens[0].combinator = leadingCombinator;
        } else if (!tokens[0].combinator) {
            tokens[0].combinator = ' ';
        }
    }

    return { tokens, leadingCombinator };
}

function selectAllSingle(root, selector) {
    const { tokens, leadingCombinator } = tokenizeSelector(selector);

    if (!tokens.length) {
        return [];
    }

    let current = [ root ];
    let startIndex = 0;

    if (leadingCombinator === 'self') {
        if (matchesSimpleSelector(root, tokens[0].selector)) {
            current = [ root ];
        } else {
            current = [];
        }
        startIndex = 1;
    }

    for (let i = startIndex; i < tokens.length; i += 1) {
        const { selector: simple, combinator } = tokens[i];
        const next = [];

        for (let j = 0; j < current.length; j += 1) {
            const node = current[j];
            const candidates = combinator === '>'
                ? getElementChildren(node)
                : getElementDescendants(node);

            for (let k = 0; k < candidates.length; k += 1) {
                const el = candidates[k];
                if (matchesSimpleSelector(el, simple)) {
                    next.push(el);
                }
            }
        }

        current = next;
        if (current.length === 0) {
            break;
        }
    }

    return current;
}

export function querySelectorAll(root, selectors) {
    if (!root || !selectors || typeof selectors !== 'string') {
        return [];
    }

    const parts = selectors.split(',').map(part => part.trim()).filter(Boolean);
    const results = [];
    const seen = new Set();

    for (let i = 0; i < parts.length; i += 1) {
        const matches = selectAllSingle(root, parts[i]);
        for (let j = 0; j < matches.length; j += 1) {
            const el = matches[j];
            if (!seen.has(el)) {
                seen.add(el);
                results.push(el);
            }
        }
    }

    return results;
}

export function querySelector(root, selectors) {
    const results = querySelectorAll(root, selectors);

    return results.length ? results[0] : null;
}
