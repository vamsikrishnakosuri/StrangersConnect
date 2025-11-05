# Strangers Connect 🌐

A free and open source application that allows strangers from around the world to connect and chat anonymously.

## Features ✨

- **Real-time Chat**: Instant messaging with WebSocket technology
- **Anonymous Matching**: Connect with random strangers
- **Privacy First**: No registration required, anonymous connections
- **Modern UI**: Beautiful, responsive design with dark mode support
- **Free & Open Source**: Completely free to use and modify

## Tech Stack 🛠️

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Socket.io
- **Real-time**: WebSocket connections for instant messaging

## Getting Started 🚀

### Prerequisites

- Node.js 18+ and npm (or yarn/pnpm)

### Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd Strangers
```

2. Install dependencies for the main app:
```bash
npm install
```

3. Install dependencies for the server:
```bash
cd server
npm install
cd ..
```

**Note for PowerShell users:** Use separate commands or `;` instead of `&&`:
```powershell
cd server; npm install; cd ..
```

### Running the Application

1. Start the Socket.io server (in one terminal):
```bash
cd server
npm run dev
```

2. Start the Next.js application (in another terminal):
```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
```

For the server, you can set:
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
```

## How It Works 🔄

1. **Connect**: The application connects to the Socket.io server
2. **Find Stranger**: Click "Find Stranger" to be matched with a random user
3. **Chat**: Once matched, you can start chatting in real-time
4. **Disconnect**: Click "Disconnect" to end the conversation and find someone new

## Project Structure 📁

```
Strangers/
├── app/                 # Next.js app directory
│   ├── page.tsx        # Main chat interface
│   ├── layout.tsx      # Root layout
│   └── globals.css     # Global styles
├── server/             # Socket.io server
│   └── index.ts        # Server logic
├── package.json        # Frontend dependencies
└── README.md           # This file
```

## Contributing 🤝

Contributions are welcome! This is an open source project, so feel free to:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License 📄

This project is licensed under the MIT License - see the LICENSE file for details.

## Safety & Privacy 🔒

- No personal information is collected
- All connections are anonymous
- Users can disconnect at any time
- Messages are not stored on the server

## Future Enhancements 🚀

Potential features for future versions:

- [ ] Topic-based chat rooms
- [ ] Language filters
- [ ] Interest matching
- [ ] File sharing
- [ ] Voice/video calls
- [ ] Mobile app version

## Support 💬

If you encounter any issues or have suggestions, please open an issue on GitHub.

---

Made with ❤️ for connecting people around the world

