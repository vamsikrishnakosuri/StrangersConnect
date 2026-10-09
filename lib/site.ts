// Single source of truth for SEO copy, structured data and the visible FAQ.
// Google requires FAQPage JSON-LD to match what is rendered on the page.

export const SITE_URL = 'https://www.strangersconnect.com'
export const SITE_NAME = 'Strangers Connect'

export const SITE_TITLE = 'Strangers Connect: Free Random Video Chat with Strangers'
export const SITE_DESCRIPTION =
    'Talk to strangers instantly with free, private random video chat. No sign-up, no app, one click to the next person. Meet new people safely, from anywhere.'

export const SITE_KEYWORDS = [
    'random video chat',
    'talk to strangers',
    'video chat with strangers',
    'chat with strangers',
    'free video chat',
    'stranger chat',
    'random chat',
    'anonymous video chat',
    'meet new people online',
    'strangers connect',
    'random video call',
    'video chat with new people',
    'talk to strangers online',
    'make friends online',
]

export const FAQ: { q: string; a: string }[] = [
    {
        q: 'What is Strangers Connect?',
        a: 'A free random video chat for meeting new people. Press Start and you are face to face with someone new in seconds, with private encrypted calls, one-tap reporting, and no sign-up.',
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
        a: 'Yes. Your video and voice are encrypted before they leave your device, and only the other person can unlock them. Our server only introduces you; it cannot watch or record your call, and nothing is saved.',
    },
    {
        q: 'Is the text chat end-to-end encrypted?',
        a: 'Yes. Every conversation gets its own fresh lock, created on your device. Our server only ever passes along scrambled text it cannot read. Messages are never stored and disappear when the call ends.',
    },
    {
        q: 'Do you save any of my data?',
        a: 'We never save your video, voice or messages, and there are no accounts or profiles. The only thing we keep is an anonymous scrambled code when someone is banned or chooses not to meet a person again, and it is deleted automatically after a few months.',
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
