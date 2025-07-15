# Vercel Deployment Setup

This guide explains how to deploy the tscircuit-deploy system on Vercel.

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **PostgreSQL Database** - Use Vercel Postgres or external provider
3. **GitHub App** - Set up for repository access

## Environment Variables

Set these in your Vercel project settings:

### Required Variables

```bash
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# GitHub Integration
GITHUB_BOT_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
DEPLOY_URL="https://your-project.vercel.app"

# Optional
NODE_ENV="production"
HOSTNAME="vercel-worker"
```

## Package.json Dependencies

Ensure these dependencies are included for Vercel compatibility:

```json
{
  "dependencies": {
    "tar": "^6.2.0",
    "@vercel/postgres": "^0.10.0",
    "drizzle-orm": "^0.44.3",
    "circuit-to-svg": "^0.0.166",
    "circuit-json-to-simple-3d": "^0.0.4",
    "tscircuit": "^0.0.534"
  }
}
```

## Vercel Configuration

Create `vercel.json` in your project root:

```json
{
  "framework": "astro",
  "buildCommand": "cd app && bun x astro build",
  "devCommand": "cd app && bun x astro dev",
  "installCommand": "bun install",
  "outputDirectory": "app/dist",
  "functions": {
    "app/src/pages/api/**/*.ts": {
      "maxDuration": 300
    }
  },
  "regions": ["iad1"],
  "env": {
    "NODE_OPTIONS": "--max-old-space-size=4096"
  }
}
```

## Database Setup

### Option 1: Vercel Postgres

1. Go to your Vercel dashboard
2. Navigate to Storage tab
3. Create a new Postgres database
4. Copy the connection string to `DATABASE_URL`

### Option 2: External Provider

Use services like:

- **Neon** (recommended) - serverless Postgres
- **PlanetScale** - serverless MySQL (requires schema changes)
- **Supabase** - managed Postgres
- **Railway** - managed database hosting

## GitHub App Setup

1. **Create GitHub App**:
   - Go to GitHub Settings > Developer settings > GitHub Apps
   - Create new app with these permissions:
     - Repository permissions: Contents (read), Pull requests (write), Statuses (write), Checks (write)
     - Generate private key and note the App ID

2. **Install App**:
   - Install the app on your repositories
   - Get the installation ID from the webhook payload

3. **Environment Variables**:
   ```bash
   GITHUB_BOT_TOKEN="your_github_token"
   ```

## Deployment Steps

### 1. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

### 2. Set Environment Variables

```bash
# Set required variables
vercel env add DATABASE_URL
vercel env add GITHUB_BOT_TOKEN
vercel env add DEPLOY_URL

# Redeploy with new variables
vercel --prod
```

### 3. Database Migration

Run database migration after first deployment:

```sql
-- Connect to your database and run:
CREATE TABLE IF NOT EXISTS deployments (
  id VARCHAR(36) PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  commit_sha VARCHAR(40) NOT NULL,
  status deployment_status DEFAULT 'pending',
  build_logs TEXT,
  error_message TEXT,
  meta TEXT NOT NULL,
  meta_type meta_type NOT NULL,
  build_completed_at TIMESTAMP,
  build_duration INTEGER,
  circuit_count INTEGER DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  snapshot_result JSONB
);

CREATE TABLE IF NOT EXISTS build_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id VARCHAR(36) REFERENCES deployments(id) NOT NULL,
  status job_status DEFAULT 'queued' NOT NULL,
  priority INTEGER DEFAULT 0 NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INTEGER DEFAULT 0 NOT NULL,
  max_retries INTEGER DEFAULT 3 NOT NULL,
  error_message TEXT,
  worker_node_id TEXT,
  queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  progress INTEGER DEFAULT 0,
  estimated_duration INTEGER,
  logs TEXT,
  metadata JSONB
);

CREATE TABLE IF NOT EXISTS build_artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES build_jobs(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB
);

-- Create enums
CREATE TYPE deployment_status AS ENUM ('skipped', 'ready', 'error', 'pending');
CREATE TYPE meta_type AS ENUM ('push', 'pull_request');
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'completed', 'failed', 'cancelled');
```

## Vercel-Specific Optimizations

### 1. Function Timeout

- Default: 10 seconds (Hobby), 60 seconds (Pro)
- Our config sets 300 seconds for API routes
- Upgrade to Pro plan for longer timeouts

### 2. Memory Limits

- Default: 1GB (Hobby), 3GB (Pro)
- Set `NODE_OPTIONS="--max-old-space-size=4096"` for larger projects

### 3. Cold Start Optimization

```typescript
// In your API routes, use this pattern:
export const config = {
  maxDuration: 300, // 5 minutes
};
```

### 4. File System Limitations

- Only `/tmp` is writable
- Files are cleaned up after function execution
- Use efficient cleanup in job processing

## Testing Your Deployment

1. **Health Check**:

   ```bash
   curl https://your-project.vercel.app/api/health
   ```

2. **Dashboard Access**:
   Visit `https://your-project.vercel.app`

3. **API Test**:
   ```bash
   curl -X POST https://your-project.vercel.app/api/build \
     -H "Authorization: Bearer $GITHUB_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{...test_payload...}'
   ```

## Troubleshooting

### Common Issues

1. **"Git command not found"**:
   - ✅ Fixed: Now uses Node.js fetch instead of git
   - Archive download is prioritized

2. **Function timeout**:
   - Increase `maxDuration` in vercel.json
   - Upgrade to Pro plan for longer limits

3. **Memory issues**:
   - Add `NODE_OPTIONS` environment variable
   - Optimize circuit processing

4. **Database connection**:
   - Verify `DATABASE_URL` format
   - Check connection pooling settings
   - Use `@vercel/postgres` for Vercel Postgres

### Debug Commands

```bash
# Check deployment logs
vercel logs your-project.vercel.app

# Check function configuration
vercel inspect your-project.vercel.app

# Test locally
vercel dev
```

## Performance Optimization

1. **Database Indexing**:

   ```sql
   CREATE INDEX idx_deployments_created_at ON deployments(created_at);
   CREATE INDEX idx_build_jobs_status ON build_jobs(status);
   CREATE INDEX idx_build_jobs_queued_at ON build_jobs(queued_at);
   ```

2. **Connection Pooling**:
   - Use Vercel Postgres built-in pooling
   - Or configure external pooling (PgBouncer)

3. **Caching**:
   - SVG responses include cache headers
   - Vercel automatically caches static responses

## Monitoring

1. **Vercel Analytics**:
   - Enable in project settings
   - Monitor function performance

2. **Database Monitoring**:

   ```sql
   -- Check queue status
   SELECT status, COUNT(*) FROM build_jobs GROUP BY status;

   -- Monitor build times
   SELECT AVG(build_duration) FROM deployments WHERE build_duration IS NOT NULL;
   ```

3. **Error Tracking**:
   - Check Vercel function logs
   - Monitor GitHub webhook delivery
   - Set up alerting for failed builds

## Scaling Considerations

1. **Vercel Pro Plan** - Required for:
   - Longer function timeouts (15 minutes)
   - More concurrent executions
   - Advanced analytics

2. **Database Scaling**:
   - Monitor connection limits
   - Consider read replicas for dashboard
   - Implement connection pooling

3. **Queue Management**:
   - Current: In-memory processing
   - Future: Redis-based queue for multi-region
   - Consider job prioritization

## Security Best Practices

1. **Environment Variables**:
   - Never commit secrets to git
   - Use Vercel's encrypted storage
   - Rotate tokens regularly

2. **API Security**:
   - GitHub token validation
   - Rate limiting (if needed)
   - Input sanitization

3. **Database Security**:
   - Use SSL connections
   - Limit user permissions
   - Regular security updates

## Support

For deployment issues:

1. Check Vercel documentation
2. Review function logs
3. Test locally with `vercel dev`
4. Verify environment variables
5. Check database connectivity
