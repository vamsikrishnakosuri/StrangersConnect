import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Strangers Connect: free random video chat, the Omegle alternative'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '72px 80px',
                    background: '#0e0e10',
                    color: '#ece9e2',
                    fontFamily: 'serif',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 26, color: '#9a978f', fontFamily: 'monospace', letterSpacing: 2 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 6, background: '#f2c14e', boxShadow: '0 0 24px #f2c14e' }} />
                    STRANGERS CONNECT
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: -2 }}>Talk to someone new.</div>
                    <div style={{ fontSize: 92, lineHeight: 1.02, letterSpacing: -2, color: '#f2c14e', fontStyle: 'italic' }}>Nothing in between.</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 26, color: '#9a978f', fontFamily: 'monospace' }}>
                    <span>Free random video chat · No sign-up · Peer-to-peer</span>
                    <span>strangersconnect.com</span>
                </div>
            </div>
        ),
        size,
    )
}
