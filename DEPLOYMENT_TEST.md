# Deployment System Test Guide

This document provides a comprehensive testing guide for the new backend-based deployment system.

## Pre-deployment Checklist

### Environment Variables

Ensure these environment variables are properly set:

```bash
# Database
DATABASE_URL="postgresql://localhost:5432/tscircuit_deploy"

# GitHub Integration
GITHUB_BOT_TOKEN="ghp_xxxxxxxxxxxxxxxxxxxx"
DEPLOY_URL="https://your-deploy-domain.com"

# Optional
HOSTNAME="worker-node-1"  # For distributed processing
NODE_ENV="production"
```

### Database Migration

Run the database migration to add new tables:

```sql
-- These tables should be created automatically from the schema
-- Verify they exist:
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('deployments', 'build_jobs', 'build_artifacts');
```

## API Endpoint Tests

### 1. Health Check

```bash
curl -X GET https://your-domain.com/api/health
# Expected: 200 OK with health status
```

### 2. Build API (New Lightweight)

```bash
curl -X POST https://your-domain.com/api/build \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-deployment-123",
    "owner": "your-username",
    "repo": "your-repo",
    "ref": "abc123",
    "environment": "preview",
    "eventType": "pull_request",
    "meta": "42",
    "context": {
      "serverUrl": "https://github.com",
      "runId": "123456789",
      "sha": "abc123",
      "message": "Test commit"
    },
    "deploymentId": 12345,
    "checkRunId": 67890,
    "repoArchiveUrl": "https://api.github.com/repos/owner/repo/archive/abc123.tar.gz"
  }'

# Expected: 200 OK with jobId and status
```

### 3. Build Status Check

```bash
curl -X GET "https://your-domain.com/api/build-status?jobId=JOB_ID_FROM_STEP_2" \
  -H "Authorization: Bearer $GITHUB_TOKEN"

# Expected: Job status with progress information
```

### 4. Deployments List

```bash
curl -X GET "https://your-domain.com/api/deployments?limit=10" \
  -H "Authorization: Bearer $GITHUB_TOKEN"

# Expected: List of deployments with pagination
```

### 5. SVG Generation (On-demand)

```bash
# After a successful deployment, test SVG generation
curl -X GET "https://your-domain.com/api/svg/DEPLOYMENT_ID/0/pcb?width=300&height=200"

# Expected: SVG content with proper headers
```

## GitHub Integration Tests

### 1. GitHub Action Test

Create a test repository with a simple circuit file:

```tsx
// test.circuit.tsx
import { resistor } from "@tscircuit/core";

export default () => (
  <board width="10mm" height="10mm">
    <resistor resistance="1k" name="R1" />
  </board>
);
```

Add GitHub workflow:

```yaml
name: Test tscircuit Deploy
on:
  pull_request:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      statuses: write
      checks: write
    steps:
      - uses: actions/checkout@v4
      - uses: tscircuit/deploy-action@v2
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          deploy-server-url: "https://your-domain.com"
```

### 2. Expected Behavior

#### For Pull Requests:

1. ✅ GitHub Action queues build successfully
2. ✅ Deployment status appears in PR checks
3. ✅ Build progresses through: queued → processing → completed
4. ✅ PR comment appears with circuit previews
5. ✅ SVG images load correctly in PR comment
6. ✅ Preview URLs work

#### For Push to Main:

1. ✅ Build completes successfully
2. ✅ Deployment shows in dashboard
3. ✅ Release creation (if enabled)

## Dashboard Tests

### 1. Access Dashboard

Navigate to: `https://your-domain.com/`

Expected features:

- ✅ Beautiful gradient background
- ✅ Stats cards showing deployment counts
- ✅ Filter functionality (owner, repo, status)
- ✅ Deployment list with details
- ✅ Status badges (ready, pending, error)
- ✅ Action buttons (View Details, Preview Circuits)

### 2. Filter Tests

- ✅ Filter by repository owner
- ✅ Filter by repository name
- ✅ Filter by status
- ✅ URL updates with filters
- ✅ Clear filters functionality

### 3. Responsive Design

- ✅ Mobile-friendly layout
- ✅ Grid adjusts to screen size
- ✅ Touch-friendly buttons

## Performance Tests

### 1. Large Repository Test

Test with a repository containing:

- Multiple circuit files (5-10)
- Large package.json
- Complex circuit designs

Expected:

- ✅ Download completes within timeout
- ✅ Build processes all circuits
- ✅ Memory usage stays reasonable
- ✅ Cleanup happens properly

### 2. Concurrent Builds Test

Submit multiple builds simultaneously:

```bash
# Submit 5 builds in parallel
for i in {1..5}; do
  curl -X POST https://your-domain.com/api/build \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"id\":\"test-$i\",...}" &
done
```

Expected:

- ✅ All builds queue successfully
- ✅ Priority ordering works (PR builds first)
- ✅ Builds process sequentially
- ✅ No race conditions

### 3. SVG Generation Performance

Test on-demand SVG generation:

```bash
# Test multiple SVG types
curl "https://your-domain.com/api/svg/DEPLOYMENT_ID/0/pcb"
curl "https://your-domain.com/api/svg/DEPLOYMENT_ID/0/schematic"
curl "https://your-domain.com/api/svg/DEPLOYMENT_ID/0/3d"
```

Expected:

- ✅ SVGs generate within 5 seconds
- ✅ Proper caching headers
- ✅ Error handling for invalid requests

## Error Handling Tests

### 1. Invalid Repository

Submit build request with non-existent repository.

Expected:

- ✅ Graceful failure
- ✅ Error message in deployment
- ✅ Failure comment in PR (if applicable)
- ✅ Check run updated with failure

### 2. Circuit Compilation Error

Submit repository with invalid circuit syntax.

Expected:

- ✅ Build fails with clear error message
- ✅ Error appears in dashboard
- ✅ PR comment shows failure details

### 3. Network Issues

Test with invalid archive URLs or network timeouts.

Expected:

- ✅ Falls back to git clone
- ✅ Retry mechanism works
- ✅ Cleanup happens on failure

## Security Tests

### 1. Authentication

```bash
# Test without token
curl -X POST https://your-domain.com/api/build
# Expected: 401 Unauthorized

# Test with invalid token
curl -X POST https://your-domain.com/api/build \
  -H "Authorization: Bearer invalid-token"
# Expected: 401 Unauthorized
```

### 2. Input Validation

```bash
# Test with malformed JSON
curl -X POST https://your-domain.com/api/build \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"invalid":}'
# Expected: 400 Bad Request

# Test with missing required fields
curl -X POST https://your-domain.com/api/build \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
# Expected: 400 Bad Request with validation errors
```

## Monitoring & Observability

### 1. Logs

Check application logs for:

- ✅ Job processing messages
- ✅ Error logs with stack traces
- ✅ Performance metrics
- ✅ Cleanup notifications

### 2. Database State

Monitor database for:

- ✅ Job queue length
- ✅ Completed deployments
- ✅ Error rates
- ✅ Build duration trends

```sql
-- Check queue status
SELECT status, COUNT(*) FROM build_jobs GROUP BY status;

-- Check recent deployments
SELECT status, COUNT(*) FROM deployments
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY status;

-- Average build times
SELECT AVG(build_duration) as avg_build_time
FROM deployments
WHERE build_duration IS NOT NULL;
```

## Production Readiness Checklist

### Infrastructure

- [ ] Database connection pooling configured
- [ ] Environment variables properly set
- [ ] HTTPS enabled
- [ ] CDN configured for static assets
- [ ] Log aggregation setup

### Scalability

- [ ] Worker nodes can be distributed
- [ ] Database can handle concurrent connections
- [ ] File cleanup working properly
- [ ] Memory usage optimized

### Reliability

- [ ] Error handling comprehensive
- [ ] Retry logic working
- [ ] Fallback mechanisms tested
- [ ] Circuit validation robust

### Security

- [ ] Input validation comprehensive
- [ ] Authentication working
- [ ] CORS properly configured
- [ ] Rate limiting implemented (if needed)

## Troubleshooting Common Issues

### Build Stuck in Queue

```bash
# Check queue status
curl "https://your-domain.com/api/build-status?jobId=JOB_ID"

# Check database
SELECT * FROM build_jobs WHERE status = 'queued' ORDER BY queued_at;
```

### PR Comments Not Appearing

1. Verify `GITHUB_BOT_TOKEN` has proper permissions
2. Check that bot is added to repository
3. Verify PR number in metadata
4. Check application logs for GitHub API errors

### SVG Generation Failing

1. Verify circuit JSON is valid
2. Check tscircuit dependencies
3. Ensure circuit-to-svg packages installed
4. Test with simple circuit first

### Dashboard Not Loading Data

1. Check API endpoint responses
2. Verify CORS headers
3. Check database connectivity
4. Validate environment variables

## Success Criteria

The system is ready for production when:

- ✅ All API endpoints respond correctly
- ✅ GitHub integration works end-to-end
- ✅ Dashboard displays data properly
- ✅ SVG generation works on-demand
- ✅ PR comments appear consistently
- ✅ Error handling is comprehensive
- ✅ Performance meets requirements
- ✅ Security measures are in place

## Migration from Old System

1. Deploy new backend code
2. Run database migrations
3. Update GitHub Action to v2
4. Test with a few repositories
5. Monitor for any issues
6. Gradually migrate all repositories
7. Remove old process endpoint (optional)
