# leed pizza Restaurant OS

Production-grade Restaurant Operating System featuring:
- **Phase 1 & 2:** Floor Command, 15-Minute Grid Reservation Engine, and AI Voice Concierge (Gemini Multimodal Live API via WebSockets).
- **Phase 3:** Kitchen Display System (KDS), Cook-Time Pacing & Ticket Expediter with automated hold-queues based on `menu_matrix.json`.
- **Phase 4:** Omnichannel Delivery Aggregation Gateway (`/api/webhooks/delivery`), Auto-Throttling Kill Switch, Courier Live Tracking, and Takeout Packing Station Dispatch Board.

---

## 🚀 Running Locally in VS Code

### 1. Prerequisites
- **Node.js**: v18.18+ or v20+ recommended
- **npm** (comes with Node.js) or **bun**

### 2. Clone / Open in VS Code
Open the project directory in VS Code:
```bash
code .
```

### 3. Install Dependencies
Open the VS Code Terminal (`Ctrl + ~` or `Cmd + ~`) and install packages:
```bash
npm install
```

### 4. Configure Your Environment Variables (`.env.local`)
Create your local environment file by copying `.env.example`:
```bash
cp .env.example .env.local
```

Open `.env.local` in VS Code and enter your **Gemini API Key**:
```env
# Get a free key at https://aistudio.google.com/app/apikey
GEMINI_API_KEY=AIzaSy...your_actual_api_key_here

# Local dev server URL
APP_URL=http://localhost:3000

# Server port
PORT=3000
```

> **Note:** The Gemini API key powers the live two-way AI Voice Concierge on Phase 1. If you run the app without the key, the entire visual POS, Floor Grid, KDS Expediter, and Delivery Dispatch board will still work completely, and the Voice Concierge will display a helpful reminder to add the key.

### 5. Start the Development Server
In the VS Code terminal, run:
```bash
npm run dev
```

The server starts at **[http://localhost:3000](http://localhost:3000)**.
- Node.js handles custom WebSocket routing for live voice streaming at `ws://localhost:3000/api/live` while Next.js compiles the App Router interface and `/api/webhooks/delivery`.

---

## 🛠 Available Scripts

- `npm run dev`: Starts the hybrid Next.js + WebSocket server on port 3000.
- `npm run build`: Compiles the Next.js application for production.
- `npm run start`: Runs the production server with WebSockets.
- `npm run lint`: Runs ESLint checks.

---

## 📁 Key Project Structure

```
├── app/
│   ├── api/
│   │   └── webhooks/delivery/route.ts  # Phase 4 3P Delivery Ingestion Route
│   ├── layout.tsx                      # Root layout & Metadata
│   ├── page.tsx                        # Home page entry
│   └── globals.css                     # Tailwind CSS entry
├── components/
│   ├── RestaurantApp.tsx               # Top-level switcher (Floor, KDS, Delivery)
│   ├── DeliveryDispatch.tsx            # Phase 4 Dispatch Dashboard & Kill Switch
│   ├── KDSExpediter.tsx                # Phase 3 Kitchen Pacing Engine & KDS
│   ├── FloorCommand.tsx                # Phase 1 & 2 Floor Grid & Voice Concierge
│   └── VoiceCallPanel.tsx              # Audio PCM streaming over WebSockets
├── lib/
│   ├── deliveryContext.tsx             # Phase 4 Delivery State & Webhook Handlers
│   ├── kdsContext.tsx                  # Phase 3 Cook-time sync & Ticket state
│   └── menuMatrix.ts                   # Toast Menu Matrix (Single Source of Truth)
├── server.mjs                          # Next.js custom server + WebSocket handler
├── menu_matrix.json                    # Single source of truth for recipes & stations
├── .env.example                        # Template for environment variables
└── .env.local                          # Your private local secrets (git-ignored)
```
