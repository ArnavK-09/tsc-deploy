# tscircuit Deploy Server

The backend server for tscircuit Deploy that handles GitHub integrations, deployment orchestration, and PR preview deployments.

## Features

- **GitHub Integration**: Manages deployments, check runs, and PR comments
- **Scalable Architecture**: Centralized deployment processing
- **API Authentication**: Secure communication with GitHub Actions
- **Database Storage**: Tracks deployment history and metadata

## Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3001
GITHUB_BOT_TOKEN=your_github_bot_personal_access_token
GITHUB_APP_TOKEN=optional_github_app_token
NODE_ENV=development
API_SECRET=optional_api_secret_for_webhook_validation
DATABASE_URL=optional_database_connection_string
DEPLOY_URL=https://deploy.tscircuit.com
DEPLOY_SERVER_URL=https://api.deploy.tscircuit.com
```

### Required Variables

- `GITHUB_BOT_TOKEN`: Personal Access Token for the GitHub bot account with repo and deployment permissions

### Optional Variables

- `API_SECRET`: If set, requires GitHub Actions to authenticate with this secret
- `GITHUB_APP_TOKEN`: For GitHub App authentication (future use)
- `DATABASE_URL`: PostgreSQL connection string for custom database

## Getting Started

1. Install dependencies:

```bash
bun install
```

2. Set up environment variables:

```bash
cp .env.example .env
# Edit .env with your values
```

3. Run the development server:

```bash
bun dev
```

4. The server will start on http://localhost:3001

## API Endpoints

### Health Check

```
GET /
GET /health
```

### GitHub Operations

All GitHub endpoints require authentication if `API_SECRET` is set.

```
POST /api/github/deployments
POST /api/github/deployments/status
POST /api/github/checks
PUT /api/github/checks/:checkRunId
POST /api/github/comments
```

### Deployment Processing

```
POST /deployments/process
POST /deployments/create
GET /deployments/:id
```

## Usage with GitHub Actions

Configure your GitHub Action to use this server:

```yaml
- name: Deploy with tscircuit
  uses: tscircuit/deploy-action@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    deploy-server-url: ${{ secrets.DEPLOY_SERVER_URL }}
    api-secret: ${{ secrets.DEPLOY_API_SECRET }}
```

## Architecture

The server acts as a centralized coordinator for deployments:

1. **GitHub Action** triggers and sends deployment request
2. **Server** orchestrates GitHub API calls (deployments, check runs, comments)
3. **Database** stores deployment metadata and history
4. **Frontend** can query deployment status and results

## Security

- API authentication via Bearer tokens
- Environment-based configuration
- Secure GitHub token handling
- CORS enabled for cross-origin requests

## Development

```bash
# Run with hot reload
bun dev

# Build for production
bun build

# Start production server
bun start
```

## Deployment

The server can be deployed to any platform that supports Bun:

- Railway
- Fly.io
- Render
- AWS/GCP/Azure
- Docker

Example Dockerfile:

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production
COPY . .
EXPOSE 3001
CMD ["bun", "start"]
```
