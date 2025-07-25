<h1 align="center">🔌 TSCircuit Deploy</h1>

<h4 align="center">Vercel-like deployment platform for TSCircuit projects - Automated circuit builds, previews, and deployments with GitHub integration.</h4>
<p align="center">
    <img alt="hero" width="450" src="https://github.com/tscircuit.png" />
</p>

> [!NOTE]
>
> ## 🚀 Overview
>
> TSCircuit Deploy is a comprehensive deployment platform that automatically builds, processes, and deploys TSCircuit projects. It provides seamless GitHub integration, real-time build monitoring, and beautiful circuit visualizations.

### ✨ Key Features

- 🔄 **Automated CI/CD** - GitHub Action integration for seamless deployments
- 📊 **Real-time Dashboard** - Monitor deployments, build status, and circuit files
- 🎨 **Circuit Visualizations** - Auto-generated PCB, schematic, and 3D views
- 🔍 **PR Previews** - Instant circuit previews on pull requests
- 📦 **Artifact Management** - Store and manage build artifacts
- ⚡ **Background Processing** - Scalable job queue system
- 🌐 **REST API** - Full API access for integrations

## 🏗️ Architecture Overview

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor': '#2563eb', 'primaryTextColor': '#fff', 'primaryBorderColor': '#1d4ed8', 'lineColor': '#3b82f6', 'secondaryColor': '#60a5fa', 'tertiaryColor': '#dbeafe', 'background': 'transparent', 'mainBkg': 'transparent', 'secondBkg': 'transparent', 'tertiaryBkg': 'transparent', 'clusterBkg': 'transparent', 'clusterBorder': '#cbd5e1'}}}%%
graph TB
    subgraph "🐙 GitHub Integration"
        GH["📦 GitHub Repository"]
        GA["⚡ GitHub Action"]
        PR["🔀 Pull Request"]
        PUSH["📤 Push Event"]
    end

    subgraph "🚀 TSCircuit Deploy Platform"
        API["🌐 REST API"]
        QUEUE["📋 Job Queue"]
        PROC["⚙️ Circuit Processor"]
        DB[("🗄️ PostgreSQL")]
        DASH["📊 Dashboard"]
    end

    subgraph "🔧 Circuit Processing"
        DETECT["🔍 File Detection"]
        BUILD["🏗️ Circuit Build"]
        SVG["🎨 SVG Generation"]
        STORE["💾 Artifact Storage"]
    end

    subgraph "📤 Outputs"
        PREVIEW["👀 Preview URLs"]
        COMMENT["💬 PR Comments"]
        ARTIFACTS["📦 Build Artifacts"]
        DEPLOY["✅ Deployment Status"]
    end

    GH --> GA
    PR --> GA
    PUSH --> GA
    GA --> API
    API --> QUEUE
    QUEUE --> PROC
    PROC --> DETECT
    DETECT --> BUILD
    BUILD --> SVG
    SVG --> STORE
    STORE --> DB
    API --> DB
    DB --> DASH
    PROC --> PREVIEW
    PROC --> COMMENT
    PROC --> ARTIFACTS
    PROC --> DEPLOY

    classDef githubStyle fill:#1e293b,stroke:#475569,stroke-width:2px,color:#f8fafc
    classDef platformStyle fill:#2563eb,stroke:#1d4ed8,stroke-width:2px,color:#ffffff
    classDef processingStyle fill:#0ea5e9,stroke:#0284c7,stroke-width:2px,color:#ffffff
    classDef outputStyle fill:#06b6d4,stroke:#0891b2,stroke-width:2px,color:#ffffff
    classDef databaseStyle fill:#3730a3,stroke:#312e81,stroke-width:3px,color:#ffffff

    class GH,GA,PR,PUSH githubStyle
    class API,QUEUE,PROC,DASH platformStyle
    class DETECT,BUILD,SVG,STORE processingStyle
    class PREVIEW,COMMENT,ARTIFACTS,DEPLOY outputStyle
    class DB databaseStyle
```

## 🛠️ Technology Stack

### **Frontend & UI**

- **Framework**: [Astro](https://astro.build/) with SSR
- **UI Library**: [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Deployment**: [Vercel](https://vercel.com/)

### **Backend & API**

- **Runtime**: [Bun](https://bun.sh/) (JavaScript runtime)
- **Database**: [PostgreSQL](https://www.postgresql.org/) with [Prisma ORM](https://www.prisma.io/)
- **Queue System**: Custom job queue with retry logic
- **File Processing**: Node.js streams and tar extraction

### **Circuit Processing**

- **Core Engine**: [TSCircuit](https://tscircuit.com/) runtime
- **SVG Generation**:
  - `circuit-to-svg` for PCB and schematic views
  - `circuit-json-to-simple-3d` for 3D visualizations
- **File Formats**: Support for `.circuit.tsx`, `.circuit.ts`, `.board.tsx`

### **GitHub Integration**

- **Actions SDK**: `@actions/core` and `@actions/github`
- **API Integration**: GitHub REST API via Octokit
- **Webhooks**: Deployment status updates and PR comments

### **Development Tools**

- **Build System**: [tsup](https://tsup.egoist.dev/) for GitHub Action
- **Type Safety**: Full TypeScript with [Zod](https://zod.dev/) validation
- **Code Quality**: Prettier formatting

## 📁 Project Structure

```
tscircuit-deploy/
├── 📱 app/                    # Astro frontend application
│   ├── src/
│   │   ├── components/        # React components
│   │   │   ├── Dashboard.tsx  # Main dashboard
│   │   │   ├── DeploymentDetails.tsx
│   │   │   ├── ArtifactList.tsx
│   │   │   └── JobList.tsx
│   │   ├── pages/            # Astro pages & API routes
│   │   │   ├── api/          # REST API endpoints
│   │   │   │   ├── build.ts  # Build trigger endpoint
│   │   │   │   ├── deployments.ts
│   │   │   │   ├── artifacts.ts
│   │   │   │   └── svg/      # SVG generation endpoints
│   │   │   └── index.astro   # Dashboard page
│   │   └── layouts/          # Page layouts
│   └── astro.config.mjs      # Astro configuration
├── 🔧 github-action/         # GitHub Action implementation
│   ├── src/index.ts         # Action entry point
│   ├── action.yml           # Action metadata
│   └── tsup.config.ts       # Build configuration
├── 🗄️ prisma/               # Database layer
│   ├── schema.prisma        # Database schema
│   └── index.ts            # Prisma client setup
├── 🔄 shared/               # Shared utilities
│   ├── types.ts            # TypeScript definitions
│   ├── constants.ts        # App constants
│   ├── env.ts              # Environment validation
│   ├── github.service.ts   # GitHub API service
│   └── job-queue.ts        # Background job system
├── ⚙️ utils/                # Processing utilities
│   ├── snapshot-processor.ts # Circuit file processor
│   ├── svg-generator.ts     # SVG generation
│   ├── file-handler.ts      # File operations
│   ├── pr-comment.ts        # PR comment generation
│   └── startup.ts           # Service initialization
└── 📋 sample-board/         # Example circuit files
```

## 🔄 Deployment Flow

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor': '#8b5cf6', 'primaryTextColor': '#fff', 'primaryBorderColor': '#7c3aed', 'lineColor': '#10b981', 'tertiaryColor': '#fef3c7', 'background': '#f8fafc', 'mainBkg': '#ffffff', 'secondBkg': '#f1f5f9', 'tertiaryBkg': '#e2e8f0'}}}%%
flowchart TD
    A[🚀 GitHub Event] --> B{🔍 Event Type?}
    B -->|📤 Push| C[🏗️ Create Deployment]
    B -->|🔄 Pull Request| D[🏗️ Create Deployment + ✅ Check Run]

    C --> E[📋 Queue Build Job]
    D --> E

    E --> F[📥 Download Repository]
    F --> G[🔍 Scan for Circuit Files]
    G --> H{📄 Files Found?}

    H -->|✅ Yes| I[⚙️ Process Each File]
    H -->|❌ No| J[📝 Mark as No Circuits]

    I --> K[🏗️ Generate Circuit JSON]
    K --> L[🎨 Create SVG Visualizations]
    L --> M[💾 Store Artifacts]

    M --> N[📊 Update Deployment Status]
    J --> N

    N --> O{🔄 Is Pull Request?}
    O -->|✅ Yes| P[💬 Post PR Comment]
    O -->|❌ No| Q[🎉 Complete]
    P --> Q

    classDef startNode fill:#ddd6fe,stroke:#8b5cf6,stroke-width:3px,color:#1f2937
    classDef processNode fill:#dcfce7,stroke:#16a34a,stroke-width:2px,color:#1f2937
    classDef decisionNode fill:#fef3c7,stroke:#f59e0b,stroke-width:2px,color:#1f2937
    classDef endNode fill:#fee2e2,stroke:#ef4444,stroke-width:2px,color:#1f2937
    classDef queueNode fill:#e0e7ff,stroke:#3b82f6,stroke-width:2px,color:#1f2937

    class A startNode
    class B,H,O decisionNode
    class C,D,F,G,I,K,L,M,N,P processNode
    class E queueNode
    class J,Q endNode
```

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor': '#6366f1', 'primaryTextColor': '#fff', 'primaryBorderColor': '#4f46e5', 'lineColor': '#10b981', 'actorBkg': '#f3f4f6', 'actorBorder': '#6b7280', 'actorTextColor': '#1f2937', 'activationBkgColor': '#ddd6fe', 'activationBorderColor': '#8b5cf6', 'sequenceNumberColor': '#fff'}}}%%
sequenceDiagram
    participant Dev as 👨‍💻 Developer
    participant GH as 🐙 GitHub
    participant GA as ⚡ GitHub Action
    participant API as 🌐 TSC Deploy API
    participant Queue as 📋 Job Queue
    participant Proc as ⚙️ Circuit Processor
    participant DB as 🗄️ Database

    Dev->>+GH: 📤 Push code / Create PR
    GH->>+GA: 🚀 Trigger workflow
    GA->>GA: 🆔 Generate deployment ID
    GA->>GH: ✅ Create deployment & check run
    GA->>+API: 📡 POST /api/build
    API->>+DB: 💾 Create deployment record
    API->>+Queue: 📋 Queue build job
    API->>-GA: 🔄 Return job ID

    Queue->>+Proc: ⚙️ Process job
    Proc->>Proc: 📥 Download repository
    Proc->>Proc: 🔍 Detect circuit files
    Proc->>Proc: 🏗️ Generate circuit JSON
    Proc->>Proc: 🎨 Create SVG visualizations
    Proc->>DB: 💾 Store artifacts
    Proc->>GH: 📊 Update deployment status
    Proc->>-GH: 💬 Post PR comment (if PR)

    Note over Dev,DB: 🎉 Build complete - artifacts available

    rect rgb(240, 253, 244)
        Note over Dev,GA: GitHub Integration Layer
    end
    rect rgb(239, 246, 255)
        Note over API,Queue: Processing Layer
    end
    rect rgb(254, 240, 138)
        Note over Proc,DB: Storage & Artifacts
    end
```

## 🎯 Core Components

### 🔧 **Circuit Processor** (`utils/snapshot-processor.ts`)

The heart of the platform that:

- 🔍 Discovers circuit files (`.circuit.tsx`, `.circuit.ts`, `.board.tsx`)
- 🏗️ Builds circuits using TSCircuit runtime
- 📊 Generates circuit JSON data
- 📈 Provides build progress tracking

### 🎨 **SVG Generator** (`utils/svg-generator.ts`)

Creates beautiful visualizations:

- 🔲 **PCB View**: Physical board layout
- 📋 **Schematic View**: Circuit diagram
- 🎮 **3D View**: Interactive 3D representation
- 🎨 Theme support (light/dark)
- 📏 Custom dimensions

### 🔄 **Job Queue System** (`shared/job-queue.ts`)

Robust background processing:

- ⚡ Priority-based job scheduling
- 🔄 Automatic retry with exponential backoff
- 📊 Real-time progress tracking
- 🛡️ Error handling and recovery
- 🧹 Automatic workspace cleanup

### 🐙 **GitHub Integration** (`shared/github.service.ts`)

Seamless GitHub workflow:

- 🚀 Deployment creation and status updates
- ✅ Check run management
- 💬 Automated PR comments with previews
- 🔗 Repository archive downloading

## 📊 Database Schema

```mermaid
%%{init: {'theme':'base', 'themeVariables': { 'primaryColor': '#059669', 'primaryTextColor': '#fff', 'primaryBorderColor': '#047857', 'lineColor': '#6366f1', 'entityBkg': '#f0f9ff', 'entityTextColor': '#1e40af', 'relationLabelColor': '#374151', 'attributeBackgroundColorOdd': '#f8fafc', 'attributeBackgroundColorEven': '#e2e8f0'}}}%%
erDiagram
    DEPLOYMENT {
        string id PK "🆔 Unique identifier"
        string owner "👤 Repository owner"
        string repo "📦 Repository name"
        string commitSha "🔗 Git commit SHA"
        enum status "📊 Deployment status"
        enum metaType "🏷️ Metadata type"
        string meta "📝 Additional metadata"
        datetime buildCompletedAt "⏰ Build completion time"
        int buildDuration "⏱️ Build duration (ms)"
        int totalCircuitFiles "📄 Circuit file count"
        datetime createdAt "📅 Creation timestamp"
        json snapshotResult "📸 Build snapshot data"
    }

    BUILD_JOB {
        uuid id PK "🆔 Job identifier"
        string deploymentId FK "🔗 Deployment reference"
        enum status "📊 Job status"
        int priority "⚡ Processing priority"
        datetime startedAt "🚀 Job start time"
        datetime completedAt "✅ Job completion time"
        int retryCount "🔄 Retry attempts"
        string errorMessage "❌ Error details"
        datetime queuedAt "📋 Queue timestamp"
        int progress "📈 Progress percentage"
        string logs "📝 Processing logs"
        json metadata "🏷️ Job metadata"
    }

    BUILD_ARTIFACT {
        uuid id PK "🆔 Artifact identifier"
        uuid jobId FK "🔗 Job reference"
        string deploymentId FK "🔗 Deployment reference"
        string fileName "📄 File name"
        string filePath "📁 File path"
        int fileSize "📏 File size (bytes)"
        datetime createdAt "📅 Creation timestamp"
        json circuitJson "⚡ Circuit JSON data"
    }

    DEPLOYMENT ||--o{ BUILD_JOB : "🔗 has"
    DEPLOYMENT ||--o{ BUILD_ARTIFACT : "📦 contains"
    BUILD_JOB ||--o{ BUILD_ARTIFACT : "⚙️ produces"
```

## 🚀 Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.2.15
- [PostgreSQL](https://www.postgresql.org/) database
- [GitHub](https://github.com/) repository

### 1. **Clone & Install**

```bash
git clone https://github.com/ArnavK-09/tscircuit-deploy.git
cd tscircuit-deploy
bun install
```

### 2. **Environment Setup**

```bash
cp example.env .env
```

Configure your `.env`:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/tscircuit_deploy"
DIRECT_URL="postgresql://user:password@localhost:5432/tscircuit_deploy"

# GitHub Integration
GITHUB_BOT_TOKEN="ghp_your_github_token"
```

### 3. **Database Setup**

```bash
# Generate Prisma client
bun run db:generate

# Push schema to database
bun run db:push

# (Optional) Open Prisma Studio
bun run db:studio
```

### 4. **Development Server**

```bash
# Start the development server
bun run start

# Or build for production
bun run build
```

### 5. **GitHub Action Setup**

Add to your repository's `.github/workflows/deploy.yml`:

```yaml
name: TSCircuit Deploy

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, reopened, synchronize]
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy to TSCircuit
        uses: ArnavK-09/tscircuit-deploy@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          working-directory: "."
          create-release: ${{ github.ref == 'refs/heads/main' }}
```

## 📖 API Reference

### **Core Endpoints**

#### `GET /api` - Health Check

Returns platform health status and database connectivity.

#### `POST /api/build` - Trigger Build

Initiates a new circuit build process.

**Request Body:**

```typescript
{
  id: string;              // Unique deployment ID
  owner: string;           // GitHub repository owner
  repo: string;            // GitHub repository name
  ref: string;             // Git commit SHA
  environment: string;     // "production" | "staging" | "preview"
  eventType: string;       // "push" | "pull_request"
  meta: string;            // Branch name or PR number
  context: {
    serverUrl: string;
    runId: string;
    sha: string;
    message?: string;
  };
  deploymentId: number;    // GitHub deployment ID
  checkRunId?: number;     // GitHub check run ID
  repoArchiveUrl?: string; // Repository archive URL
}
```

#### `GET /api/deployments` - List Deployments

Retrieve deployments with filtering and pagination.

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (max: 100, default: 20)
- `owner` - Filter by repository owner
- `repo` - Filter by repository name
- `status` - Filter by deployment status
- `id` - Get specific deployment

#### `GET /api/deployment/{id}` - Get Deployment Details

Retrieve detailed information about a specific deployment including build jobs and artifacts.

**Path Parameters:**

- `id` - Deployment identifier (required)

**Response:**

```typescript
{
  success: boolean;
  deployment: {
    id: string;
    owner: string;
    repo: string;
    commitSha: string;
    status: "pending" | "ready" | "error";
    metaType: string;
    meta: string;
    buildDuration: number | null;
    totalCircuitFiles: number;
    createdAt: string; // ISO timestamp
    buildCompletedAt: string | null; // ISO timestamp
    snapshotResult: any;
    buildJobs: {
      id: string;
      status: string;
      priority: number;
      startedAt: string | null; // ISO timestamp
      completedAt: string | null; // ISO timestamp
      retryCount: number;
      errorMessage: string | null;
      queuedAt: string; // ISO timestamp
      progress: number;
      logs: string | null;
      metadata: any;
      buildArtifacts: {
        id: string;
        fileName: string;
        filePath: string;
        fileSize: number;
        createdAt: string; // ISO timestamp
        circuitJson: any;
      }
      [];
    }
    [];
    buildArtifacts: {
      id: string;
      fileName: string;
      filePath: string;
      fileSize: number;
      createdAt: string; // ISO timestamp
      circuitJson: any;
      jobId: string;
    }
    [];
  }
}
```

**Error Responses:**

- `400` - Deployment ID is required
- `404` - Deployment not found
- `500` - Internal server error

#### `GET /api/svg/{deploymentId}/{fileIndex}/{type}` - Generate SVG

Generate circuit visualizations on-demand.

**Parameters:**

- `deploymentId` - Deployment identifier
- `fileIndex` - Circuit file index
- `type` - `"pcb"` | `"schematic"` | `"3d"`

**Query Parameters:**

- `width` - SVG width (optional)
- `height` - SVG height (optional)
- `theme` - `"light"` | `"dark"` (optional)

## 🔧 Configuration

### **Environment Variables**

| Variable            | Description                  | Required | Default                         |
| ------------------- | ---------------------------- | -------- | ------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string | ✅       | -                               |
| `DIRECT_URL`        | Direct database connection   | ✅       | -                               |
| `GITHUB_BOT_TOKEN`  | GitHub API token             | ✅       | -                               |
| `NODE_ENV`          | Environment mode             | ❌       | `development`                   |
| `DEPLOY_URL`        | Platform base URL            | ❌       | `https://tsc-deploy.vercel.app` |
| `DEPLOY_SERVER_URL` | API server URL               | ❌       | `https://tsc-deploy.vercel.app` |

### **GitHub Action Inputs**

| Input               | Description                    | Required | Default               |
| ------------------- | ------------------------------ | -------- | --------------------- |
| `github-token`      | GitHub token for API access    | ❌       | `${{ github.token }}` |
| `working-directory` | Working directory for commands | ❌       | `"."`                 |
| `create-release`    | Create release for production  | ❌       | `false`               |

## 🎨 Circuit File Support

The platform automatically detects and processes:

### **Supported File Types**

- 📄 `.circuit.tsx` - React TSX circuit components
- 📄 `.circuit.ts` - TypeScript circuit files
- 📄 `.board.tsx` - Board layout files

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Workflow**

1. 🍴 Fork the repository
2. 🌿 Create a feature branch
3. 💻 Make your changes
4. ✅ Add tests if applicable
5. 🎨 Run `bun run format`
6. 🔍 Run `bun run check`
7. 📤 Submit a pull request

### **Project Scripts**

```bash
# Development
bun run start          # Start dev server
bun run build          # Build for production
bun run build:action   # Build GitHub Action
bun dev               # Development with hot reload

# Database
bun run db:generate    # Generate Prisma client
bun run db:push        # Push schema changes
bun run db:migrate     # Run migrations
bun run db:studio      # Open Prisma Studio
bun run db:reset       # Reset database
bun run db:seed        # Seed database with sample data

# Quality
bun run format         # Format code
bun run check          # Type checking
bun test              # Run tests
bun run test:watch     # Run tests in watch mode
bun run test:coverage  # Generate test coverage
bun run lint          # Run ESLint

# Deployment
bun run deploy:staging # Deploy to staging
bun run deploy:prod    # Deploy to production
bun run health-check   # Check deployment health
```

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 👤 Author

<table>
  <tbody>
    <tr>
        <td align="center" valign="top" width="14.28%"><a href="https://github.com/ArnavK-09"><img src="https://github.com/ArnavK-09.png?s=100" width="130px;" alt="Arnav K"/></a><br /><a href="https://github.com/ArnavK-09"<h4><b>Arnav K</b></h3></a></td>
    </tr>
  </tbody>
</table>

---

<div align="center">
  <strong>Built with ❤️ by the TSCircuit community</strong>
  <br><br>
  <a href="https://tscircuit.com">🌐 Website</a> •
  <a href="https://github.com/ArnavK-09/tscircuit-deploy">📦 GitHub</a> •
  <a href="https://tsc-deploy.vercel.app">🚀 Live Demo</a> •
  <a href="https://docs.tscircuit.com">📚 Docs</a> •
  <a href="https://discord.gg/tscircuit">💬 Discord</a>
</div>
