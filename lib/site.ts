// Single source of truth for SEO copy, structured data and the visible FAQ.
// Google requires FAQPage JSON-LD to match what is rendered on the page.

export const SITE_URL = 'https://www.strangersconnect.com'
export const SITE_NAME = 'Strangers Connect'

export const SITE_TITLE = 'Strangers Connect: Free Random Video Chat, the Omegle Alternative'
export const SITE_DESCRIPTION =
    'Talk to strangers instantly with free, peer-to-peer random video chat. No sign-up, no app, one click to the next person. A private, open-source Omegle alternative.'

export const SITE_KEYWORDS = [
    'omegle alternative',
    'sites like omegle',
    'omegle',
    'random video chat',
    'talk to strangers',
    'video chat with strangers',
    'chat with strangers',
    'free video chat',
    'stranger chat',
    'random chat',
    'anonymous video chat',
    'meet new people online',
    'chatroulette alternative',
    'ometv alternative',
    'strangers connect',
]

export const FAQ: { q: string; a: string }[] = [
    {
        q: 'Is Strangers Connect an Omegle alternative?',
        a: 'Yes. Omegle shut down in November 2023. Strangers Connect gives you the same one-click random video chat with strangers, rebuilt with peer-to-peer video, a report and ban system, and open-source code you can inspect.',
    },
    {
        q: 'Is it free?',
        a: 'Completely free. There are no subscriptions, coins, or paid filters. The project is open source under the MIT license.',
    },
    {
        q: 'Do I need to create an account?',
        a: 'No. Open the site, allow your camera and microphone, and press Start. There is no sign-up, no email, and no profile.',
    },
    {
        q: 'Is my video private?',
        a: 'Video and audio travel directly between you and the other person over WebRTC, encrypted in transit with DTLS-SRTP. Our server only helps the two browsers find each other; it does not receive or record your video.',
    },
    {
        q: 'Is the text chat end-to-end encrypted?',
        a: 'Yes. Each match creates a fresh key pair in your browser (ECDH P-256 with AES-256-GCM). Only the public halves pass through our server, so it relays scrambled text it cannot read. Messages are never stored and vanish when the call ends.',
    },
    {
        q: 'Do you save any of my data?',
        a: 'No. There is no database, no chat history and no recordings. The server keeps only what it needs in memory to match people, and IP addresses are never logged. If someone is banned, only a one-way hash of their address is kept.',
    },
    {
        q: 'Does it work on my phone?',
        a: 'Yes. Strangers Connect runs in the browser on iPhone, Android, and desktop. There is nothing to download.',
    },
    {
        q: 'What if someone is inappropriate?',
        a: 'Press Report. You are disconnected right away, and accounts that collect repeated reports are banned automatically.',
    },
    {
        q: 'Who can use Strangers Connect?',
        a: 'Strangers Connect is for adults 18 and over. Be kind, keep it legal, and skip anyone who makes you uncomfortable.',
    },
]
