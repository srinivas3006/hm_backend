# Hg Backend API

A Node.js/Express backend API for the HomeMatch platform.

## Project Structure

```
hm_backend/
├── src/
│   ├── models/           # MongoDB schemas
│   ├── controllers/      # Business logic
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── config/          # Configuration files
│   ├── services/        # Business services
│   ├── utils/           # Utility functions
│   ├── validators/      # Input validation schemas
│   ├── jobs/            # Scheduled jobs
│   └── constants/       # Application constants
├── public/              # Static files
├── tests/               # Test files
├── server.js            # Application entry point
├── package.json         # Project dependencies
├── .env.example         # Environment template
└── .gitignore          # Git ignore rules
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)
- MongoDB

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hm_backend
```

2. Install dependencies:
```bash
npm install
```

3. Create .env file:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

The server will start on the port specified in .env (default: 3000)

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload (nodemon)
- `npm test` - Run tests
- `npm run lint` - Lint the code
- `npm run format` - Format code with prettier


## License

ISC
