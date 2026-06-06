# WhatsApp AI Customer Support Agent

A complete Node.js backend application that acts as an AI-powered customer support bot for e-commerce businesses on WhatsApp. The bot listens for incoming customer messages, processes them using Claude AI, and replies automatically based on a JSON knowledge base.

## Features

✅ **Automatic Replies** - Bot responds to customer queries using Claude AI
✅ **Knowledge Base** - JSON files for products, FAQs, policies, offers, and store info
✅ **Conversation Memory** - Stores last 20 messages per customer for context
✅ **Human Handoff** - Detects keywords and alerts owner for human support
✅ **Session Management** - Track individual customer conversations
✅ **Auto-reload Knowledge** - Knowledge base updates every 10 minutes
✅ **Typing Indicators** - Bot shows "typing..." status before replying
✅ **REST API** - Endpoints to manage sessions, check health, reload knowledge

## Project Structure

```
whatsapp-agent/
├── index.js                  # Main server and WhatsApp bot
├── agent.js                  # Claude AI integration
├── sessionManager.js         # Conversation history management
├── knowledgeBase.js          # Knowledge base loader
├── humanHandoff.js           # Handoff detection and alerts
├── data/                     # Knowledge base JSON files
│   ├── products.json
│   ├── faqs.json
│   ├── policies.json
│   ├── store_info.json
│   └── offers.json
├── sessions/                 # Auto-created - customer chat histories
├── auth_info_baileys/        # Auto-created - WhatsApp session
├── .env                      # Environment variables
├── package.json
└── README.md
```

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

Dependencies are already installed in `package.json`.

### 2. Configure Environment Variables

Edit `.env` file with your credentials:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
OWNER_NUMBER=923001234567
PORT=3000
```

**How to get ANTHROPIC_API_KEY:**
1. Go to https://console.anthropic.com
2. Create a new API key
3. Copy it and paste in `.env`

**OWNER_NUMBER:** Your WhatsApp number (used to identify owner messages and send alerts)

### 3. Update Knowledge Base

Edit the files in `/data/` folder to match your store:

- `store_info.json` - Store name, contact, hours
- `products.json` - Your product catalog
- `faqs.json` - Frequently asked questions
- `policies.json` - Shipping, returns, payment policies
- `offers.json` - Current promotions and discount codes

### 4. Start the Bot

**Development mode (with auto-restart on file changes):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

### 5. Authenticate with WhatsApp

1. A QR code will appear in the terminal
2. Open WhatsApp on your phone
3. Go to **Settings → Linked Devices → Link a Device**
4. Scan the QR code shown in the terminal
5. Your bot is now live! 🎉

## How It Works

1. **Customer sends a message** → Bot receives it via WhatsApp Web
2. **Bot checks conversation history** → Retrieves last 20 messages
3. **Claude processes the message** → Using knowledge base + history
4. **Bot checks for handoff triggers** → Keywords like "human", "support", etc.
5. **Bot sends typing indicator** → Shows "typing..." status
6. **Bot waits 1-3 seconds** → Feels more natural and human-like
7. **Bot sends reply** → Via WhatsApp

## Core Rules

⚠️ **IMPORTANT:**

- Bot **NEVER initiates conversations** - only replies when customers message first
- Bot **ignores owner's own messages** - prevents self-reply loops
- Bot **ignores group messages** - only handles private chats
- Bot **triggers handoff** - when customer uses: "human", "agent", "support", "help me", "real person", etc.
- Bot **never makes up information** - only uses knowledge base
- Bot **keeps messages short** - designed for WhatsApp conversations

## REST API Endpoints

### Get Server Health
```
GET /health
```
Returns server uptime, WhatsApp connection status

### List All Active Sessions
```
GET /sessions
```
Returns all customer chat sessions with message counts

### View Customer Chat History
```
GET /sessions/:number
```
Returns all messages for a specific customer

### Clear Customer Chat History
```
DELETE /sessions/:number
```
Clears conversation history for a customer

### Re-enable Bot for Handed-Off Customer
```
POST /reset-handoff/:number
```
Removes customer from handoff set, bot responds again

### Manually Reload Knowledge Base
```
POST /reload-knowledge
```
Triggers immediate knowledge base reload (normally auto-reloads every 10 mins)

## Example Usage

### Testing with cURL

```bash
# Check health
curl http://localhost:3000/health

# View all sessions
curl http://localhost:3000/sessions

# View specific customer chat
curl http://localhost:3000/sessions/923001234567

# Clear chat history
curl -X DELETE http://localhost:3000/sessions/923001234567

# Re-enable bot for handed-off customer
curl -X POST http://localhost:3000/reset-handoff/923001234567

# Reload knowledge base
curl -X POST http://localhost:3000/reload-knowledge
```

## Knowledge Base Auto-Reload

The bot automatically reloads all JSON files from `/data/` every 10 minutes. You can update product info, offers, policies, etc. without restarting the server. Use the `/reload-knowledge` endpoint to trigger an immediate reload.

## Troubleshooting

### Bot not responding
1. Check `.env` file has correct `ANTHROPIC_API_KEY`
2. Verify you scanned the QR code successfully
3. Check that the customer isn't in the handoff set

### WhatsApp connection lost
- Bot will automatically attempt to reconnect
- If it keeps failing, restart with `npm start`

### Claude API errors
- Verify your `ANTHROPIC_API_KEY` is valid
- Check API rate limits on https://console.anthropic.com
- Ensure you have API credits

### Messages not storing in sessions
- Check `/sessions` folder has read/write permissions
- Restart the server with `npm start`

## Technology Stack

| Tool | Purpose |
|---|---|
| Node.js + Express.js | Server and REST API |
| @whiskeysockets/baileys | WhatsApp Web connection |
| @anthropic-ai/sdk | Claude AI integration |
| Local JSON files | Knowledge base (no database) |
| express-async-errors | Error handling |
| pino | Logging |
| qrcode-terminal | QR code in terminal |

## Notes

- This is a **Node.js backend only** - no web UI needed
- The bot uses **WhatsApp Web** (no official WhatsApp Business API)
- Keep your `.env` file **secure** - never commit it to version control
- The `/sessions` folder stores chat histories - back it up regularly
- Knowledge base updates don't require server restart

## License

MIT

---

Built for Pakistani e-commerce businesses. Designed to handle customer queries automatically via WhatsApp without ever messaging customers first.
