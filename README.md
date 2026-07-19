# PBS Chat MCP Server

A Model Context Protocol (MCP) server for querying the Australian Pharmaceutical Benefits Scheme (PBS) API. This server allows AI assistants like Claude to access real-time PBS data including medicine pricing, prescriber information, schedules, and more.

## Features

- Query PBS items (medicines, pricing, forms, brands)
- Search prescribers and prescribers by PBS code, type, schedule
- Get item overviews with detailed pricing
- Access schedules, ATC codes, organisations, restrictions, criteria
- Get copayment, fee, markup band, program information
- View summary of changes

## Quick Start

### 1. Get a PBS API Subscription Key

1. Visit [PBS Data API Portal](https://data-api-portal.health.gov.au/)
2. Sign up for an account
3. Subscribe to "PBS Public API v3"
4. Get your subscription key from the developer portal

### 2. Local Development

```bash
# Clone and install
git clone https://github.com/rakeshnirzari1/pbs-chat-mcp.git
cd pbs-chat-mcp
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your PBS_API_SUBSCRIPTION_KEY

# Build and run
npm run build
npm start
```

### 3. Using with Claude Desktop (Local)

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pbs-chat": {
      "command": "node",
      "args": ["/path/to/pbs-chat-mcp/dist/index.js"],
      "env": {
        "PBS_API_SUBSCRIPTION_KEY": "your-subscription-key-here"
      }
    }
  }
}
```

## Remote Deployment (Render)

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/rakeshnirzari1/pbs-chat-mcp.git
git push -u origin main
```

### 2. Deploy on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repo `rakeshnirzari1/pbs-chat-mcp`
4. Configure:
   - **Name**: `pbs-chat-mcp`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (or Starter for better reliability)
5. Add Environment Variable:
   - Key: `PBS_API_SUBSCRIPTION_KEY`
   - Value: `your-pbs-subscription-key`
6. Deploy!

### 3. Use as Remote MCP in Claude

Once deployed, you'll get a URL like `https://pbs-chat-mcp.onrender.com`

In Claude Desktop config:

```json
{
  "mcpServers": {
    "pbs-chat": {
      "command": "npx",
      "args": ["mcp-remote", "https://pbs-chat-mcp.onrender.com"],
      "env": {
        "PBS_API_SUBSCRIPTION_KEY": "your-subscription-key-here"
      }
    }
  }
}
```

**Note**: For remote MCP, you'll need the `mcp-remote` package. The server runs via stdio transport through the remote connection.

## Available Tools

### `pbs_api`

Query any PBS API endpoint.

**Parameters:**
- `endpoint` (required): PBS API endpoint name
- `method`: HTTP method (GET/POST, default: GET)
- `params`: Query parameters object
- `subscriptionKey`: Override default API key
- `timeout`: Request timeout in ms (default: 30000)

**Available Endpoints:**
- `items` - Medicine items with pricing, brands, forms
- `prescribers` - Prescriber information
- `item-overview` - Detailed item information
- `schedules` - PBS schedules
- `atc-codes` - Anatomical Therapeutic Chemical codes
- `organisations` - Pharmaceutical organisations
- `restrictions` - Prescribing restrictions
- `parameters` - API parameters
- `criteria` - Prescribing criteria
- `copayments` - Patient copayment information
- `fees` - Dispensing fees
- `markup-bands` - Wholesale markup bands
- `programs` - PBS programs
- `summary-of-changes` - Schedule changes

## Example Queries

```json
// Search for metformin items
{
  "endpoint": "items",
  "params": {
    "drug_name": "metformin",
    "get_latest_schedule_only": "true",
    "limit": "20"
  }
}

// Get prescribers for a specific PBS code
{
  "endpoint": "prescribers",
  "params": {
    "pbs_code": "10001J",
    "get_latest_schedule_only": "true",
    "limit": "10"
  }
}

// Get item overview with pricing
{
  "endpoint": "item-overview",
  "params": {
    "get_latest_schedule_only": "true",
    "limit": "5"
  }
}
```

## API Rate Limits

The PBS Public API has rate limits:
- **Public API**: 1 request per 20 seconds (shared across all users)
- **Private API**: Higher limits (requires special access)

## Project Structure

```
pbs-chat-mcp/
├── src/
│   ├── index.ts           # MCP server entry point
│   ├── schemas.ts         # Zod schemas for validation
│   └── tools/
│       └── pbsApi.ts      # PBS API client & handler
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

## License

MIT License - see LICENSE file for details.

## Author

Rakesh Nirzari - [GitHub](https://github.com/rakeshnirzari1)