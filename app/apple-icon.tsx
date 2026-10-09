import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div style={{ width: '100%', height: '100%', display: 'flex', background: '#18181c' }}>
                <svg width="180" height="180" viewBox="0 0 32 32">
                    <g fill="none" stroke="#ece9e2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.2 8 H10.8 C 7.4 8, 6.6 12, 9 13.6 L 23 18.4 C 25.4 20, 24.6 24, 21.2 24 H17.8" />
                        <path d="M14.2 6 L23.2 4.3 M14.2 10 L23.2 11.7" />
                        <ellipse cx="23.2" cy="8" rx="1.3" ry="3.7" fill="#18181c" />
                        <ellipse cx="14.2" cy="8" rx="0.6" ry="2" />
                        <path d="M17.8 22 L8.8 20.3 M17.8 26 L8.8 27.7" />
                        <ellipse cx="8.8" cy="24" rx="1.3" ry="3.7" fill="#18181c" />
                        <ellipse cx="17.8" cy="24" rx="0.6" ry="2" />
                    </g>
                    <circle cx="16" cy="16" r="2.6" fill="#f2c14e" fillOpacity="0.45" />
                    <circle cx="16" cy="16" r="1.3" fill="#f6d488" />
                </svg>
            </div>
        ),
        size,
    )
}
