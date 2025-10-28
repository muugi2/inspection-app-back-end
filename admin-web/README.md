# Inspection App Admin Panel

Admin web interface for the Inspection Management System.

## Features

- **Authentication**: Login with admin credentials
- **Dashboard**: Overview of inspections and statistics
- **Inspection Management**: View and manage inspections
- **User Management**: Manage users and roles
- **Responsive Design**: Works on desktop and mobile

## Getting Started

### Prerequisites

- Node.js 18+ 
- Backend API running on `http://localhost:3000`

### Installation

1. Navigate to the admin-web directory:
```bash
cd inspection-app-back-end/admin-web
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001) in your browser

## Test Credentials

Based on the test data in `test-data.sql`:

### Admin User
- **Email**: `admin@mmnt.mn`
- **Password**: `password123`
- **Role**: Admin
- **Organization**: Measurement

### Inspector Users
- **Email**: `inspector1@mmnt.mn`
- **Password**: `password123`
- **Role**: Inspector
- **Organization**: Tavan Tolgoi

## API Integration

The admin panel connects to the backend API at `http://localhost:3000`. Make sure the backend is running before starting the admin panel.

### API Endpoints Used

- `POST /api/auth/login` - User authentication
- `GET /api/inspections/assigned` - Get assigned inspections
- `GET /api/users` - Get users list
- `GET /api/templates` - Get inspection templates

## Project Structure

```
admin-web/
├── src/
│   ├── app/
│   │   ├── login/          # Login page
│   │   ├── dashboard/      # Dashboard page
│   │   ├── layout.tsx      # Root layout
│   │   └── page.tsx        # Home page (redirects)
│   ├── lib/
│   │   ├── api.ts          # API configuration
│   │   └── auth.ts         # Authentication utilities
│   └── middleware.ts       # Route protection
├── package.json
└── README.md
```

## Technologies Used

- **Next.js 16** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Axios** - HTTP client
- **React Hooks** - State management

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Environment Variables

Create a `.env.local` file for environment-specific configuration:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

## Features Overview

### Login Page
- Clean, responsive design
- Form validation
- Error handling
- Test credentials display
- Automatic redirect after login

### Dashboard
- Statistics cards showing inspection counts
- Inspections table with status indicators
- User information display
- Logout functionality
- Responsive design

### Authentication
- JWT token-based authentication
- Automatic token refresh
- Protected routes
- Session persistence

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is part of the Inspection Management System.