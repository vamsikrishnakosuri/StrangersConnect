# Strangers Connect - Portfolio Description

## Brief Description (2-3 sentences)

**Strangers Connect** is a modern, privacy-focused video chat application that enables anonymous connections between strangers worldwide. Built with Next.js and WebRTC, the platform features real-time video calling, encrypted text messaging, and a responsive design with dark/light mode support. The application uses peer-to-peer WebRTC technology for direct video streaming, ensuring optimal performance and privacy.

## Key Features to Highlight

- **Real-time Video Chat**: WebRTC-based peer-to-peer video calling with zoom and pan controls
- **End-to-End Encryption**: AES-GCM encryption for all text messages (server cannot read messages)
- **Modern UI/UX**: Responsive design with dark/light mode toggle, WhatsApp-like gesture controls
- **Cross-Platform**: Works seamlessly on desktop and mobile with portrait/landscape optimization
- **Anonymous Matching**: No registration required, instant random matching system
- **Free & Open Source**: 100% free to use, fully open source

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Socket.io (WebSocket signaling)
- **Real-time Communication**: WebRTC (peer-to-peer video/audio)
- **Security**: Web Crypto API (browser-native E2E encryption)
- **Deployment**: Vercel (frontend), Render.com (backend)

## Technical Highlights

- Implemented complex WebRTC signaling with ICE candidate queuing and race condition handling
- Built responsive video controls with pinch-to-zoom and tap-to-swap functionality
- Designed and implemented end-to-end encryption system using Web Crypto API
- Optimized for mobile devices with portrait-first video orientation
- Created scalable matchmaking system with Socket.io

## Portfolio Entry (Short Version)

**Strangers Connect** - A privacy-focused video chat platform enabling anonymous connections with real-time peer-to-peer video calling and end-to-end encrypted messaging. Built with Next.js, WebRTC, and Socket.io, featuring modern UI with dark/light mode and mobile-optimized responsive design.

## Portfolio Entry (Detailed Version)

**Strangers Connect** is a full-stack video chat application that connects strangers worldwide through secure, real-time communication. The platform leverages WebRTC for peer-to-peer video streaming, eliminating the need for video data to pass through servers. I implemented a sophisticated signaling system using Socket.io to handle WebRTC offer/answer exchange and ICE candidate management, solving complex race conditions and network connectivity issues.

The application features end-to-end encryption for all text messages using the Web Crypto API, ensuring complete privacy. The modern, minimalist UI includes dark/light mode support, WhatsApp-inspired gesture controls (pinch-to-zoom, tap-to-swap), and responsive design that automatically adapts to mobile (portrait) and desktop (landscape) orientations.

Built with Next.js 14, TypeScript, and Tailwind CSS on the frontend, and Node.js with Socket.io on the backend, the application is deployed on Vercel and Render.com with a total hosting cost of $0-7/month depending on traffic.

