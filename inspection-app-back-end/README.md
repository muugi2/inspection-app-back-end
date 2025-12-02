# Inspection App Backend

A Node.js backend API for managing inspection workflows with MySQL database and Docker support.

## Features

- RESTful API for inspection management
- MySQL database with phpMyAdmin UI
- Docker containerization
- Health check endpoints
- Security middleware (Helmet, CORS)

## Quick Start with Docker

### Prerequisites

- Docker
- Docker Compose
- MySQL Workbench (desktop application)

### Running the Application

1. **Clone and navigate to the project directory**

   ```bash
   cd Back-End
   ```

2. **Start all services with Docker Compose**

   ```bash
   docker-compose up -d
   ```

3. **Access the services**
   - **API**: http://localhost:3000
   - **MySQL**: localhost:3306

### Database Access with MySQL Workbench

**MySQL Connection Details:**

- Host: `localhost`
- Port: `3306`
- Database: `inspection_app`

**Connection Options:**

1. **Root User (Full Access):**
   - Username: `root`
   - Password: `rootpassword`

2. **Application User (Limited Access):**
   - Username: `inspection_user`
   - Password: `inspection_password`

### Docker Commands

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild and start
docker-compose up --build -d

# Remove all containers and volumes
docker-compose down -v
```

## API Endpoints

### Health Check

- `GET /health` - Application health status

### Base

- `GET /` - API information

### Inspections

- `GET /api/inspections` - Get all inspections
- `POST /api/inspections` - Create new inspection
- `GET /api/inspections/:id` - Get specific inspection
- `PUT /api/inspections/:id` - Update inspection
- `DELETE /api/inspections/:id` - Delete inspection

### Users

- `GET /api/users` - Get all users
- `POST /api/users` - Create new user
- `GET /api/users/:id` - Get specific user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user

## Database Schema

The application includes the following tables:

- **users**: User management with roles (admin, inspector, viewer)
- **inspections**: Main inspection records
- **inspection_items**: Individual items within inspections

## Development

### Local Development (without Docker)

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Set up environment variables**

   ```bash
   cp config.env .env
   ```

3. **Start the server**
   ```bash
   npm start
   ```

### Environment Variables

Create a `.env` file based on `config.env`:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_NAME=inspection_app
DB_USER=inspection_user
DB_PASSWORD=inspection_password
JWT_SECRET=your-secret-key-here
API_VERSION=v1
```

## Project Structure

```
Back-End/
├── routes/
│   ├── inspections.js
│   └── users.js
├── mysql/
│   └── init/
│       └── 01-create-database.sql
├── server.js
├── package.json
├── docker-compose.yml
├── Dockerfile
├── .dockerignore
├── healthcheck.js
└── config.env
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Ensure ports 3000 and 3306 are available
2. **Database connection**: Wait for MySQL to fully start before accessing the API
3. **Permission issues**: Ensure Docker has proper permissions
4. **MySQL Workbench connection**: Make sure the MySQL container is running before connecting

### Logs

```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs mysql
docker-compose logs app
```

## Security Notes

- Change default passwords in production
- Use environment variables for sensitive data
- Enable SSL in production
- Regularly update Docker images
