// Two paper-cup telephones joined by a string. The string traces an S for Strangers,
// and the glow sits where the two voices meet.
export function LogoMark({ className = 'h-8 w-8' }: { className?: string }) {
    return (
        <svg viewBox="0 0 32 32" className={className} role="img" aria-label="Strangers Connect">
            <defs>
                <filter id="logo-glow" x="-100%" y="-100%" width="300%" height="300%">
                    <feGaussianBlur stdDeviation="1.4" />
                </filter>
            </defs>
            <rect x="0.5" y="0.5" width="31" height="31" rx="9" fill="#18181c" stroke="#ece9e2" strokeOpacity="0.14" />
            <g fill="none" stroke="#ece9e2" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.2 8 H10.8 C 7.4 8, 6.6 12, 9 13.6 L 23 18.4 C 25.4 20, 24.6 24, 21.2 24 H17.8" />
                <path d="M14.2 6 L23.2 4.3 M14.2 10 L23.2 11.7" />
                <ellipse cx="23.2" cy="8" rx="1.3" ry="3.7" fill="#18181c" />
                <ellipse cx="14.2" cy="8" rx="0.6" ry="2" />
                <path d="M17.8 22 L8.8 20.3 M17.8 26 L8.8 27.7" />
                <ellipse cx="8.8" cy="24" rx="1.3" ry="3.7" fill="#18181c" />
                <ellipse cx="17.8" cy="24" rx="0.6" ry="2" />
            </g>
            <circle cx="16" cy="16" r="2.4" fill="#f2c14e" filter="url(#logo-glow)" />
            <circle cx="16" cy="16" r="1.2" fill="#f6d488" />
        </svg>
    )
}
