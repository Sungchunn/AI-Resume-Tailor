# n8n LinkedIn Scraper Integration

This document describes how to connect the existing n8n APIFY LinkedIn scraper workflow to the webapp webhook endpoints.

## Webapp Endpoints

The following endpoints are available for job listing ingestion:

| Endpoint | Method | Description |
| -------- | ------ | ----------- |
| `/api/webhooks/job-listings` | POST | Batch ingest (up to 2000 jobs) |
| `/api/webhooks/job-listings/single` | POST | Single job ingest |
| `/api/webhooks/job-listings/{external_job_id}` | DELETE | Deactivate a job |

**No authentication is required** for these webhook endpoints.

---

## n8n Workflow Modifications

### Overview

The existing "Linkedin Jobs v3" workflow has 4 parallel APIFY scraper branches. We need to:

1. Add a **Code node** after each APIFY node to tag the region
2. Add a **Merge node** to combine all 4 branches
3. Add a **Code node** to build the payload envelope
4. Add an **HTTP Request node** to POST to the webapp

```mermaid
[APIFY: Thai]       ──→ [Code: Tag "thailand"]  ──┐
[APIFY: Taiwan]     ──→ [Code: Tag "taiwan"]    ──┤
[APIFY: Singapore]  ──→ [Code: Tag "singapore"] ──┼──→ [Merge] ──→ [Code: Build Payload] ──→ [HTTP Request]
[APIFY: 4th region] ──→ [Code: Tag "other"]     ──┘
```

---

## Step-by-Step Instructions

### Step 1: Add Region Tag Nodes (4 Code nodes)

After each APIFY scraper node, add a **Code** node:

1. Click the **+** button after the APIFY node
2. Search for "Code" and select it
3. Name it descriptively (e.g., "Tag Region Thailand")
4. Set **Mode** to "Run Once for All Items"
5. Paste the appropriate code (see below)

**Code for Thailand branch:**

```javascript
for (const item of $input.all()) {
  item.json.region = "thailand";
}
return $input.all();
```

**Code for Taiwan branch:**

```javascript
for (const item of $input.all()) {
  item.json.region = "taiwan";
}
return $input.all();
```

**Code for Singapore branch:**

```javascript
for (const item of $input.all()) {
  item.json.region = "singapore";
}
return $input.all();
```

**Code for 4th region branch:**

```javascript
for (const item of $input.all()) {
  item.json.region = "other";
}
return $input.all();
```

### Step 2: Add Merge Node

1. Click the **+** button after one of the Tag Region nodes
2. Search for "Merge" and select it
3. Name it "Merge All Regions"
4. Set **Mode** to "Combine"
5. Set **Combine By** to "Combining All Inputs"
6. Connect all 4 Tag Region nodes to this single Merge node

**Important:** You need to connect all 4 outputs to this single Merge node. In n8n, you can drag multiple connections to the same input.

### Step 3: Add Build Payload Node

1. Click the **+** button after the Merge node
2. Add a **Code** node
3. Name it "Build Payload"
4. Set **Mode** to "Run Once for All Items"
5. Paste this code:

```javascript
const jobs = $input.all().map(item => item.json);
const now = new Date().toISOString();
const regions = [...new Set(jobs.map(j => j.region).filter(Boolean))];

return [{
  json: {
    jobs: jobs,
    metadata: {
      source: "linkedin",
      scraper: "silentflow/linkedin-jobs-scraper-ppr",
      scrapedAt: now,
      totalJobs: jobs.length,
      regions: regions
    }
  }
}];
```

### Step 4: Add HTTP Request Node

1. Click the **+** button after the Build Payload node
2. Add an **HTTP Request** node
3. Name it "POST to Webapp"
4. Configure as follows:

| Setting | Value |
| ------- | ----- |
| Method | POST |
| URL | `{{ $env.WEBAPP_WEBHOOK_URL }}/api/webhooks/job-listings` |
| Authentication | None |
| Send Body | ON |
| Body Content Type | JSON |
| Specify Body | Using JSON |
| JSON | `={{ $json }}` |

**Additional Settings:**

- **Options** → **Timeout**: 120000 (2 minutes)
- **Options** → **Retry On Fail**: ON
- **Options** → **Max Tries**: 3
- **Options** → **Wait Between Tries (ms)**: 5000

### Step 5: Configure Environment Variable

1. Go to **Settings** → **Variables** in n8n
2. Add a new variable:
   - **Name**: `WEBAPP_WEBHOOK_URL`
   - **Value**: `http://your-webapp-host:8000` (or your production URL)

For local development with Docker, use: `http://host.docker.internal:8000`

---

## Importable Workflow JSON

Copy and import this JSON into n8n to add the post-scrape nodes. You'll need to connect the Merge node inputs to your existing APIFY outputs.

```json
{
  "name": "LinkedIn Jobs Post-Processing",
  "nodes": [
    {
      "parameters": {
        "jsCode": "for (const item of $input.all()) {\n  item.json.region = \"thailand\";\n}\nreturn $input.all();"
      },
      "id": "tag-thailand",
      "name": "Tag Region Thailand",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 0]
    },
    {
      "parameters": {
        "jsCode": "for (const item of $input.all()) {\n  item.json.region = \"taiwan\";\n}\nreturn $input.all();"
      },
      "id": "tag-taiwan",
      "name": "Tag Region Taiwan",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 200]
    },
    {
      "parameters": {
        "jsCode": "for (const item of $input.all()) {\n  item.json.region = \"singapore\";\n}\nreturn $input.all();"
      },
      "id": "tag-singapore",
      "name": "Tag Region Singapore",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 400]
    },
    {
      "parameters": {
        "jsCode": "for (const item of $input.all()) {\n  item.json.region = \"other\";\n}\nreturn $input.all();"
      },
      "id": "tag-other",
      "name": "Tag Region Other",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [600, 600]
    },
    {
      "parameters": {
        "mode": "combine",
        "combineBy": "combineAll",
        "options": {}
      },
      "id": "merge-all",
      "name": "Merge All Regions",
      "type": "n8n-nodes-base.merge",
      "typeVersion": 3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "jsCode": "const jobs = $input.all().map(item => item.json);\nconst now = new Date().toISOString();\nconst regions = [...new Set(jobs.map(j => j.region).filter(Boolean))];\n\nreturn [{\n  json: {\n    jobs: jobs,\n    metadata: {\n      source: \"linkedin\",\n      scraper: \"silentflow/linkedin-jobs-scraper-ppr\",\n      scrapedAt: now,\n      totalJobs: jobs.length,\n      regions: regions\n    }\n  }\n}];"
      },
      "id": "build-payload",
      "name": "Build Payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1050, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "={{ $env.WEBAPP_WEBHOOK_URL }}/api/webhooks/job-listings",
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={{ $json }}",
        "options": {
          "timeout": 120000,
          "retry": {
            "maxTries": 3,
            "waitBetweenTries": 5000
          }
        }
      },
      "id": "http-post",
      "name": "POST to Webapp",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [1250, 300]
    }
  ],
  "connections": {
    "Tag Region Thailand": {
      "main": [
        [
          {
            "node": "Merge All Regions",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tag Region Taiwan": {
      "main": [
        [
          {
            "node": "Merge All Regions",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tag Region Singapore": {
      "main": [
        [
          {
            "node": "Merge All Regions",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Tag Region Other": {
      "main": [
        [
          {
            "node": "Merge All Regions",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Merge All Regions": {
      "main": [
        [
          {
            "node": "Build Payload",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Build Payload": {
      "main": [
        [
          {
            "node": "POST to Webapp",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Chunking for Large Payloads

If you experience timeouts with large batches (>1000 jobs), add a **Split In Batches** node:

1. Insert a **Split In Batches** node between "Build Payload" and "POST to Webapp"
2. Set **Batch Size** to 500
3. Modify the "Build Payload" code to work per-batch:

```javascript
// This version works with Split In Batches
const jobs = $input.all().map(item => item.json);
const now = new Date().toISOString();
const regions = [...new Set(jobs.map(j => j.region).filter(Boolean))];

// Return as array for batching
return $input.all().map(item => ({
  json: {
    jobs: [item.json],
    metadata: {
      source: "linkedin",
      scraper: "silentflow/linkedin-jobs-scraper-ppr",
      scrapedAt: now,
      totalJobs: 1,
      regions: [item.json.region].filter(Boolean)
    }
  }
}));
```

**Alternative:** Keep the payload builder as-is and add batching logic that accumulates jobs before sending.

---

## Testing

### Test with Small Batch

Before running the full scrape, test with a small sample:

1. Manually trigger the workflow
2. Limit APIFY to return only 5-10 jobs per region
3. Check the webapp response:

```json
{
  "received": 40,
  "created": 38,
  "updated": 2,
  "errors": 0,
  "error_details": []
}
```

### Verify in Database

Check that jobs were created:

```sql
SELECT COUNT(*) FROM job_listings WHERE region IN ('thailand', 'taiwan', 'singapore', 'other');
SELECT external_job_id, job_title, region, last_synced_at FROM job_listings ORDER BY created_at DESC LIMIT 10;
```

---

## Expected Response Format

### Success (200 OK)

```json
{
  "received": 1600,
  "created": 1450,
  "updated": 150,
  "errors": 0,
  "error_details": []
}
```

### Partial Success (200 OK with errors)

```json
{
  "received": 1600,
  "created": 1440,
  "updated": 150,
  "errors": 10,
  "error_details": [
    {
      "index": 123,
      "id": "bad-job-id",
      "error": "Missing required field: id, title, or jobUrl"
    }
  ]
}
```

---

## Troubleshooting

### Common Issues

1. **Connection Refused**: Ensure the webapp is running and accessible from n8n
2. **Timeout**: Increase the HTTP Request timeout or use chunking
3. **Invalid JSON**: Check the APIFY output format matches the expected schema
4. **Missing Fields**: Ensure all required fields (`id`, `title`, `jobUrl`, `companyName`, `description`) are present

### Logs

Check webapp logs for detailed error information:

```bash
docker-compose logs -f backend
```

Look for lines like:

```txt
INFO: Batch ingestion complete: received=1600, created=1450, updated=150, errors=0
```
