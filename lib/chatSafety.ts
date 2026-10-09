// Chat safety checks. Messages are end-to-end encrypted, so these run on the user's
// own device after decryption; nothing is sent anywhere for checking.

export type PersonalKind = 'phone number' | 'email address' | 'home address' | 'social handle'

export interface SafetyReport {
    links: boolean
    personal: PersonalKind[]
    offensive: boolean
    risky: boolean // money requests or moving to another app: common scam patterns
}

const URL_RE = /\b(?:https?:\/\/|www\.)[^\s]+|\b[a-z0-9-]{2,}\.(?:com|net|org|io|me|co|ly|gg|xyz|app|link|info|ru|cn|tk|top|site|online|live|tv|to|biz|club|vip|shop)\b(?:\/[^\s]*)?/gi
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const PHONE_RE = /(?:\+?\d[\s().-]*){9,}/
const HANDLE_RE = /(?:^|\s)@[a-z0-9_.]{3,}/i
const ADDRESS_RE = /\b\d{1,5}\s+\w+(?:\s\w+)?\s(?:street|st|avenue|ave|road|rd|lane|ln|drive|dr|boulevard|blvd|nagar|colony|marg)\b/i
const APPS_RE = /\b(?:insta(?:gram)?|ig|snap(?:chat)?|telegram|whats\s?app|discord|kik|wechat|line id|onlyfans|of link)\b/i
const MONEY_RE = /\b(?:cash\s?app|venmo|paypal|zelle|bitcoin|btc|crypto|usdt|gift\s?cards?|send (?:me )?money|wire (?:me|transfer)|invest(?:ment)?|bank details|card number|otp)\b/i

// Small list of slurs and strong profanity. Matched as whole words, case-insensitive.
const OFFENSIVE = [
    'fuck', 'fucking', 'fucker', 'motherfucker', 'shit', 'bitch', 'bastard', 'cunt', 'dick', 'cock', 'pussy',
    'whore', 'slut', 'nigger', 'nigga', 'faggot', 'fag', 'retard', 'rape', 'rapist', 'kys', 'kill yourself',
    'chutiya', 'madarchod', 'bhenchod', 'randi', 'gaandu',
]
const OFFENSIVE_RE = new RegExp(`\\b(?:${OFFENSIVE.map((w) => w.replace(/\s+/g, '\\s+')).join('|')})\\b`, 'i')

export function checkMessage(text: string): SafetyReport {
    const personal: PersonalKind[] = []
    if (PHONE_RE.test(text)) personal.push('phone number')
    if (EMAIL_RE.test(text)) personal.push('email address')
    if (ADDRESS_RE.test(text)) personal.push('home address')
    if (HANDLE_RE.test(text) || APPS_RE.test(text)) personal.push('social handle')
    return {
        links: splitLinks(text).some((p) => p.link),
        personal,
        offensive: OFFENSIVE_RE.test(text),
        risky: MONEY_RE.test(text) || APPS_RE.test(text),
    }
}

/** Splits text into plain parts and link parts so links can be shown but never made clickable. */
export function splitLinks(text: string): { text: string; link: boolean }[] {
    const parts: { text: string; link: boolean }[] = []
    let last = 0
    for (const m of text.matchAll(URL_RE)) {
        const start = m.index ?? 0
        // The domain part of an email address is not a link
        const wordStart = text.lastIndexOf(' ', start) + 1
        if (text.slice(wordStart, start + m[0].length).includes('@')) continue
        if (start > last) parts.push({ text: text.slice(last, start), link: false })
        parts.push({ text: m[0], link: true })
        last = start + m[0].length
    }
    if (last < text.length) parts.push({ text: text.slice(last), link: false })
    return parts
}
