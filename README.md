# tscircuit Deploy

A Vercel-like deployment platform for tscircuit projects with automatic preview builds, semantic versioning, and CI/CD integration.

## 🚀 Features

- **One-click repository connection** with automatic CI/CD setup
- **Preview deployments** on every pull request with live URLs
- **Automatic semantic versioning** for main branch releases
- **Circuit snapshot & diff visualization** using tscircuit semantics
- **Auditable deployment history** with tamper-proof logs
- **GitHub App integration** with status checks and PR comments

## 📋 Quick Start

### 1. Install the GitHub App

Install the [tscircuit Deploy GitHub App](https://github.com/apps/tscircuit-deploy) and select your repository.

### 2. Add the Workflow

Create `.github/workflows/tscircuit-deploy.yml`:

```yaml
name: tscircuit Deploy
on:
  push:
    branches: ["main"]
  pull_request:

jobs:
  tscircuit:
    permissions:
      contents: read
      pull-requests: write
      statuses: write
      checks: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: tscircuit/cli-action@v1
        with:
          args: deploy
```

### 3. Deploy

Commit and push your changes. A **Preview Deploy** link will appear on your PR within a few minutes.

When you merge to main, tscircuit.com automatically publishes your new package version. 🎉

## 🏗️ Architecture

```mermaid
graph TB
    A[GitHub Repository] --> B[GitHub App Webhooks]
    B --> C[Bot Service]
    C --> D[Build Queue]
    D --> E[tscircuit CLI]
    E --> F[Circuit Snapshots]
    F --> G[Preview Server]

    C --> H[Database]
    G --> H

    I[GitHub Actions] --> J[CLI Action]
    J --> E

    K[Pull Request] --> L[Status Checks]
    K --> M[PR Comments]
    L --> G
    M --> G
```

This project consists of:

- **`apps/bot/`** - GitHub App webhook handler and build orchestration
- **`apps/server/`** - Preview deployment server with circuit visualization
- **`packages/shared/`** - Common types, utilities, and database schema
- **`packages/github-action/`** - Reusable GitHub Action for CI/CD workflows

## 🛠️ Development Setup

### Prerequisites

- [Bun](https://bun.sh/) >= 1.2.15
- [PostgreSQL](https://postgresql.org/) >= 14
- [GitHub App](https://docs.github.com/en/developers/apps/creating-a-github-app) credentials

### Installation

```bash
# Clone the repository
git clone https://github.com/tscircuit/tscircuit-deploy.git
cd tscircuit-deploy

# Install dependencies
bun install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://localhost:5432/tscircuit_deploy

# GitHub App
GITHUB_APP_ID=your_app_id
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# Services
BOT_PORT=3001
SERVER_PORT=3000
NODE_ENV=development
```

### Database Setup

```bash
# Create database
createdb tscircuit_deploy

# Run migrations (coming soon)
bun run migrate
```

## 🔧 Troubleshooting

### Database Connection Issues

If you encounter `SASL: Last message was not SASLResponse` or similar database authentication errors:

#### 1. Check DATABASE_URL Format

Ensure your `DATABASE_URL` follows the correct format:

```bash
# For local PostgreSQL
DATABASE_URL=postgresql://username:password@localhost:5432/database_name

# For Vercel Postgres
DATABASE_URL=postgres://username:password@host:5432/database_name?sslmode=require

# For Neon Database
DATABASE_URL=postgresql://username:password@ep-xxx.region.neon.tech/database_name?sslmode=require
```

#### 2. Verify Environment Variables

Check that environment variables are properly set in your deployment:

```bash
# Test the health endpoint
curl https://your-deployment-url/api/

# Response should include database connection status
{
  "success": true,
  "status": "healthy",
  "database": {
    "connected": true
  }
}
```

#### 3. Database Provider Configuration

- **Vercel Postgres**: Ensure you're using the connection string from Vercel dashboard
- **Neon Database**: Verify the connection string includes `?sslmode=require`
- **Local PostgreSQL**: Check that the database server is running and accessible

#### 4. Vercel Deployment Issues

If the error occurs only in production:

1. Check environment variables in Vercel dashboard
2. Ensure `DATABASE_URL` is set in production environment
3. Verify the database allows connections from Vercel's IP ranges
4. Test the connection manually using the health endpoint

#### 5. Debug Database Connection

Use the enhanced health check endpoint to diagnose issues:

```bash
curl https://your-deployment-url/api/
```

This will return detailed information about:

- Database connection status
- Environment configuration
- Connection error details

### Development

```bash
# Start all services in development mode
bun run dev

# Or start individual services
bun run dev --filter=bot      # GitHub App webhook handler
bun run dev --filter=server   # Preview deployment server
```

## 📚 API Documentation

### Artifacts API

#### Get Build Artifacts

Get all build artifacts for a deployment:

```bash
GET /api/artifacts?deploymentId={deploymentId}
GET /api/artifacts?jobId={jobId}
GET /api/artifacts?artifactId={artifactId}
```

Query Parameters:

- `deploymentId` - Get artifacts for a specific deployment
- `jobId` - Get artifacts for a specific build job
- `artifactId` - Get specific artifact details
- `fileType` - Filter by file type (default: "circuit-json")

#### Download Circuit JSON

Download individual circuit JSON files:

```bash
GET /api/artifacts/{artifactId}/download
```

Returns the circuit JSON file with proper headers for download.

### Deployments API

#### Get Deployment Details

```bash
GET /api/deployments?id={deploymentId}
```

Response includes:

- Deployment metadata
- Build status and duration
- Circuit file count
- Artifact count and availability
- Complete snapshot result with circuit data

### SVG Generation API

#### Generate Circuit SVGs

```bash
GET /api/svg/{deploymentId}/{fileIndex}/{type}
```

Parameters:

- `deploymentId` - Deployment ID
- `fileIndex` - Index of circuit file (0-based)
- `type` - SVG type: "pcb", "schematic", or "3d"

Query Parameters:

- `width` - SVG width (optional)
- `height` - SVG height (optional)
- `theme` - "light" or "dark" (optional)

## 📊 Project Roadmap

### Phase 1: Core Infrastructure ✅

- [x] Foundational architecture with TypeScript types
- [x] Database schema with Drizzle ORM
- [x] GitHub App with webhook handling
- [x] Basic build service and repository management
- [x] Preview deployment server with HTML rendering

### Phase 2: CI/CD Pipeline ✅

- [x] GitHub Action for workflow automation
- [x] Circuit file detection and validation
- [x] Semantic version bumping logic
- [x] Build artifact generation
- [x] PR status checks and comments

### Phase 3: Enhanced Features (In Progress)

- [x] Build artifacts storage for circuit JSON files
- [x] Build artifacts API for downloading individual circuit files
- [ ] Interactive circuit viewer with WebGL
- [ ] Snapshot diff visualization with side-by-side comparison
- [ ] Build caching and optimization
- [ ] Multi-environment support (dev, staging, prod)
- [ ] Custom domain support for preview deployments

### Phase 4: Advanced Capabilities (Planned)

- [ ] Real-time build streaming and logs
- [ ] Slack/Teams notifications
- [ ] Branch-level environments
- [ ] Local-to-cloud development sync
- [ ] A/B testing for circuit variations
- [ ] Performance monitoring and analytics

### Phase 5: Enterprise Features (Future)

- [ ] SSO integration with GitHub Organizations
- [ ] Advanced access controls and permissions
- [ ] Audit compliance and security scanning
- [ ] Multi-cloud deployment support
- [ ] API rate limiting and quotas

## 🎯 Success Metrics

| Goal                                 | Target                        | Status            |
| ------------------------------------ | ----------------------------- | ----------------- |
| One-click repo setup with auto CI/CD | ≥90% success rate on first PR | 🔄 In Development |
| Preview deploy speed                 | ≤4 min median build time      | 🔄 In Development |
| Production uptime                    | ≥99.5% availability           | 🔄 In Development |
| Automatic version selection          | ≥95% correct semantic bumps   | 🔄 In Development |
| Historical auditability              | 2+ year retention             | 🔄 In Development |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Code Structure

```
tscircuit-deploy/
├── apps/
│   ├── bot/           # GitHub App webhook handler
│   └── server/        # Preview deployment server
├── packages/
│   ├── shared/        # Common utilities and types
│   └── github-action/ # Reusable GitHub Action
└── docs/              # Documentation
```

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes and add tests
4. Run tests: `bun test`
5. Run linting: `bun run lint`
6. Commit with conventional commits: `git commit -m 'feat: add amazing feature'`
7. Push and create a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Vercel](https://vercel.com) for inspiration on deployment UX
- [tscircuit](https://tscircuit.com) community for feedback and testing
- [Hono](https://hono.dev) for the excellent TypeScript web framework
- [Drizzle ORM](https://orm.drizzle.team) for type-safe database operations

---

**Built with ❤️ by the tscircuit community**
