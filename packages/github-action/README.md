# tscircuit Deploy GitHub Action

A GitHub Action for deploying tscircuit projects with automatic preview builds, snapshot generation, and semantic versioning.

## Features

- 🔍 **Automatic Circuit Detection**: Finds `.circuit.tsx`, `.circuit.ts`, and `.board.tsx` files
- 📸 **Snapshot Generation**: Creates circuit snapshots and metadata
- 🚀 **Preview Deployments**: Generates preview URLs for pull requests
- 📊 **GitHub Integration**: Creates deployments, check runs, and PR comments
- ⚡ **Fast & Lightweight**: Minimal dependencies for quick execution

## Usage

### Basic Setup

```yaml
name: tscircuit Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    permissions:
      contents: read
      pull-requests: write
      deployments: write    # Required for GitHub Deployments API
      statuses: write       # Required for status updates
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy tscircuit
        uses: ./packages/github-action  # or tscircuit/tscircuit-deploy@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

### Advanced Configuration

```yaml
- name: Deploy tscircuit
  uses: tscircuit/tscircuit-deploy@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    deploy-url: ${{ vars.DEPLOY_URL || 'https://deploy.tscircuit.com' }}
    timeout: '15'
    working-directory: './circuits'
    args: 'deploy --verbose'
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | GitHub token for API access | No | `${{ github.token }}` |
| `deploy-url` | Base URL for deployment service | No | `https://deploy.tscircuit.com` |
| `args` | Arguments to pass to tscircuit CLI | No | `deploy` |
| `timeout` | Build timeout in minutes | No | `10` |
| `working-directory` | Working directory for commands | No | `.` |

## Outputs

| Output | Description |
|--------|-------------|
| `deployment-id` | Unique identifier for this deployment |
| `preview-url` | URL for preview deployment (if applicable) |
| `package-version` | Published package version (for production) |
| `build-time` | Total build time in seconds |
| `circuit-count` | Number of circuit files processed |

## Permissions

The action requires specific GitHub permissions to function properly:

### Required Permissions
- `contents: read` - Read repository contents
- `pull-requests: write` - Create/update PR comments

### Optional Permissions (for enhanced features)
- `deployments: write` - Create GitHub deployments
- `statuses: write` - Update commit statuses

> **Note**: If deployment permissions are not available, the action will continue to work but without GitHub Deployments API integration. You'll see warnings in the logs about permissions.

## Error Handling

### Common Issues

#### "Resource not accessible by integration"
This error occurs when the GitHub token lacks deployment permissions. Solutions:

1. **Add Permissions** (Recommended):
   ```yaml
   permissions:
     contents: read
     pull-requests: write
     deployments: write
     statuses: write
   ```

2. **Continue Without Deployments**: The action will automatically fall back to basic functionality without GitHub Deployments API.

#### "No circuit files found"
The action looks for files matching:
- `*.circuit.tsx`
- `*.circuit.ts` 
- `*.board.tsx`

Ensure your circuit files follow this naming convention.

## What It Does

### For Pull Requests
1. 🔍 Scans for circuit files
2. 📸 Generates snapshots in `.tscircuit/snapshots/`
3. 🚀 Creates preview deployment (if permissions allow)
4. ✅ Updates PR with comment and check status
5. 🔗 Provides preview URL for testing

### For Push to Main
1. 🔍 Scans for circuit files
2. 📸 Generates snapshots
3. 🏭 Creates production deployment
4. 📦 Prepares for semantic versioning (future)

## Development

### Building
```bash
cd packages/github-action
bun install
bun run build
```

### Testing
```bash
bun run check-types
```

## Examples

See the [examples directory](../../.github/workflows/) for complete workflow examples:
- `sample-deploy.yml` - Basic setup
- `tscircuit-deploy.yml` - Advanced setup with releases

## Support

For issues and feature requests, please visit the [tscircuit Deploy repository](https://github.com/tscircuit/tscircuit-deploy). 