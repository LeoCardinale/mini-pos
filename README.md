# Mini POS System

A Progressive Web App (PWA) point-of-sale system with offline-first capabilities and multi-device synchronization.

## Features

- 🔄 Offline-First Architecture
- 📱 Multi-Device Synchronization
- 📦 Inventory Management
- 💰 Sales Processing
- 🏧 Cash Register Control
- 📊 Basic Reporting

## Tech Stack

- Frontend: React, TypeScript, Vite, TailwindCSS
- Backend: Node.js, Express, Prisma
- Database: SQLite (development), PostgreSQL (production)
- Storage: IndexedDB for local storage
- State Management: React Context

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Git

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/mini-pos.git
cd mini-pos
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
cd backend
npm install
```

4. Set up the database:
```bash
npx prisma migrate reset
```

5. Create environment files:
   - Copy `.env.example` to `.env` in both root and backend directories
   - Update the environment variables as needed

## Development

1. Start the frontend development server:
```bash
npm run dev
```

2. Start the backend server:
```bash
cd backend
npm run dev
```

## Testing

```bash
# Run frontend tests
npm test

# Test sync functionality
# Open multiple browsers and use Chrome DevTools to simulate offline mode
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [List any credits or inspirations]