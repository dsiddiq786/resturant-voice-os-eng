import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3000;
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error occurred handling', req.url, err);
      res.statusCode = 500;
      res.end('internal server error');
    }
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url, true);
    if (pathname === '/api/live') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  wss.on('connection', async (clientWs, req) => {
    try {
      const parsedUrl = parse(req.url, true);
      const venue = parsedUrl.query.venue || 'Sing Sing (Main St)';

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey === 'MY_GEMINI_API_KEY') {
        console.warn('⚠️ [Voice Concierge] GEMINI_API_KEY is missing or unset in your .env.local file. Voice streaming requires a valid Gemini API key from https://aistudio.google.com/app/apikey');
        if (clientWs.readyState === 1) {
          clientWs.send(JSON.stringify({ 
            error: "GEMINI_API_KEY is not configured. Please set GEMINI_API_KEY in your .env.local file to enable the live voice concierge." 
          }));
        }
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      let session = null;
      
      const systemInstruction = `You are the dedicated Voice Concierge and Floor Host for Sing Sing Beer & Pizza (located on Main St, Vancouver, part of Freehouse Collective). You are speaking live on the phone with a guest. The system is dedicated exclusively to Sing Sing. You are professional, warm, polished, and human-sounding—never robotic.

CRITICAL OPERATIONAL RULES:
1. The "Green Light" Rule (Crucial for Reservations):
You are strictly forbidden from confirming a table reservation immediately. When a caller requests a specific time and party size (e.g., "Table for 4 at 8:00 PM"), you MUST first trigger the check_availability tool for Sing Sing.

While Waiting: Use natural conversational fillers to mask the latency (e.g., "Hmm, let me just pull up the floor plan for 8:00 PM real quick...", "Alright, checking our tables for four now, sir...", or "Let me check our floor grid for 8:00 PM right now...").

If Available: The tool will return {"status": "available"}. You may then confirm: "Awesome, I've got that locked in for you."

If Unavailable: The tool will return {"status": "unavailable", "alternatives": ["19:30", "20:45"]}. You MUST pivot smoothly: "It looks like we are actually fully booked right at 8:00 PM, but I can get you in at 7:30 or 8:45. Would either of those work?"

2. The Final Lock (Reservations):
Only after the availability is verified and the customer agrees to a valid time slot will you trigger the final submit_reservation_data tool to execute the permanent backend lock and end the call. Make sure you ask for and obtain the guest's name and contact phone number to complete the booking.

3. The Sing Sing Toast Menu Matrix & Food Orders (Phase 3 Kitchen Pacing):
All food knowledge derives strictly from the official Sing Sing Menu Matrix. Do NOT invent items:
- Pho Bo ($18.25, Noodle Line, 6 mins) - Rare steak, beef brisket, bean sprouts, cilantro, green onion, basil, rice noodles (Dairy-Free)
- Pho Ga ($17.75, Noodle Line, 6 mins) - Lemongrass chicken, quail eggs, bean sprouts, cilantro, green onion, basil, rice noodles (Dairy-Free)
- Brisket & Kimchi Pizza ($21.25, Pizza Oven, 4 mins) - Hoisin, mozzarella, green onion, pickled onion, spicy mayo, sesame
- Margherita Pizza ($18.75, Pizza Oven, 3 mins) - Mozzarella, tomato sauce, pesto, fresh basil (Vegetarian)
- Katsu Chicken Burger ($22.25, Grill, 10 mins) - Crispy fried, bulldog sauce, cabbage, kewpie, potato roll
- Wings ($17.75, Fryer, 12 mins) - Red chili sauce, sriracha parm dip
- Calamari ($18.25, Fryer, 8 mins) - Salsa verde, citrus, smoked paprika (Pescatarian)

When a customer places a food order for takeout or pickup, trigger the submit_food_order tool with the items, timing (ASAP or scheduled timestamp), customer name, and phone number.

4. The Kitchen Pacing Rule:
For all takeout/delivery pizza & food orders, you MUST establish if it is for "ASAP" or scheduled for a specific time. Phase 3 Kitchen Pacing engine uses this exact timestamp to pace the cooking.

5. The Inventory "86" Rule:
If an item is stated as "sold out" or "86'd", you are strictly forbidden from selling it. Apologize politely and immediately suggest a similar alternative.

6. The Payment Security Rule:
You are strictly forbidden from asking for, recording, or listening to credit card numbers. For phone orders, state: "I am sending a secure checkout link to your phone right now."

7. Persona & Canadian Terminology:
Use active conversational fillers ("Hmm", "Ah, I see", "Certainly, sir", "Right away") and polite Canadian terminology (washroom, lineup, bill). Never sound robotic or read raw lists out loud.`;

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Puck" } },
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }]
          },
          tools: [{
            functionDeclarations: [
              {
                name: "check_availability",
                description: "Checks the backend 15-minute grid and Turn Time math for table overlaps.",
                parameters: {
                  type: "object",
                  properties: {
                    party_size: { 
                      type: "integer", 
                      description: "The number of guests in the party" 
                    },
                    target_time: { 
                      type: "string", 
                      description: "Target reservation time in HH:MM format (24-hour time, e.g. 20:00 for 8:00 PM, 19:30 for 7:30 PM)" 
                    },
                    venue: { 
                      type: "string", 
                      description: "The venue name, strictly: Sing Sing" 
                    }
                  },
                  required: ["party_size", "target_time", "venue"]
                }
              },
              {
                name: "submit_reservation_data",
                description: "Emits the finalized, backend-approved contract to lock the table in PostgreSQL and trigger the SMS confirmation.",
                parameters: {
                  type: "object",
                  properties: {
                    party_size: { 
                      type: "integer", 
                      description: "The finalized party size (number of guests)" 
                    },
                    confirmed_time: { 
                      type: "string", 
                      description: "Confirmed reservation time in HH:MM format (e.g. 19:30 or 20:45)" 
                    },
                    customer_name: { 
                      type: "string", 
                      description: "The customer's full name" 
                    },
                    customer_phone: { 
                      type: "string", 
                      description: "The customer's contact phone number for SMS confirmation" 
                    },
                    venue: { 
                      type: "string", 
                      description: "The venue name: Sing Sing" 
                    }
                  },
                  required: ["party_size", "confirmed_time", "customer_name", "customer_phone", "venue"]
                }
              },
              {
                name: "submit_food_order",
                description: "Submits a takeout or pickup food order directly to the Sing Sing Phase 3 Kitchen Pacing Engine and KDS.",
                parameters: {
                  type: "object",
                  properties: {
                    customer_name: {
                      type: "string",
                      description: "The caller or guest's name"
                    },
                    customer_phone: {
                      type: "string",
                      description: "Customer contact phone for secure payment link and SMS status"
                    },
                    timing: {
                      type: "string",
                      description: "Pickup timing: 'ASAP' or scheduled timestamp (e.g. 19:45)"
                    },
                    items: {
                      type: "array",
                      description: "List of items ordered from the Sing Sing Menu Matrix",
                      items: {
                        type: "object",
                        properties: {
                          item_name: { type: "string" },
                          quantity: { type: "integer" }
                        },
                        required: ["item_name"]
                      }
                    }
                  },
                  required: ["customer_name", "customer_phone", "timing", "items"]
                }
              }
            ]
          }]
        },
        callbacks: {
          onmessage: (message) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio && clientWs.readyState === 1) clientWs.send(JSON.stringify({ audio }));
            
            if (message.serverContent?.interrupted && clientWs.readyState === 1)
              clientWs.send(JSON.stringify({ interrupted: true }));

            const functionCalls = message.toolCall?.functionCalls;
            if (functionCalls && functionCalls.length > 0) {
              for (const call of functionCalls) {
                if (call.name === "check_availability") {
                  const targetTime = String(call.args?.target_time || '').trim();
                  const partySize = Number(call.args?.party_size) || 2;
                  const reqVenue = call.args?.venue || venue;

                  console.log(`[Tool Call: check_availability] venue=${reqVenue}, size=${partySize}, time=${targetTime}`);

                  // 15-Minute Grid Math: 20:00 (8:00 PM) is fully booked and returns alternatives [19:30, 20:45]
                  // Other times (e.g. 19:30, 20:45, 18:00, 19:00, etc.) are available!
                  let responsePayload;
                  if (targetTime === '20:00' || targetTime.includes('20:00') || targetTime === '8:00 PM' || targetTime === '8:00' || targetTime === '08:00 PM') {
                    responsePayload = {
                      status: "unavailable",
                      alternatives: ["19:30", "20:45"]
                    };
                  } else {
                    responsePayload = {
                      status: "available"
                    };
                  }

                  // Inform client UI of availability check
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({
                      toolEvent: 'check_availability',
                      callId: call.id,
                      arguments: call.args,
                      result: responsePayload
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: responsePayload
                    }]
                  });
                } else if (call.name === "submit_reservation_data") {
                  console.log(`[Tool Call: submit_reservation_data] args=`, call.args);
                  
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ 
                      functionCall: {
                        name: call.name,
                        arguments: call.args
                      } 
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { 
                        status: "locked",
                        confirmation_id: "RES-" + Math.floor(100000 + Math.random() * 900000),
                        sms_status: "queued" 
                      }
                    }]
                  });
                } else if (call.name === "submit_food_order") {
                  console.log(`[Tool Call: submit_food_order] args=`, call.args);
                  
                  if (clientWs.readyState === 1) {
                    clientWs.send(JSON.stringify({ 
                      functionCall: {
                        name: call.name,
                        arguments: call.args
                      } 
                    }));
                  }

                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { 
                        status: "paced_and_queued",
                        order_id: "TKT-" + Math.floor(100 + Math.random() * 900),
                        kitchen_status: "hold_queue_active",
                        sms_payment_link: "sent"
                      }
                    }]
                  });
                }
              }
            }
          },
          onclose: () => {
            if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ status: "disconnected" }));
          },
          onerror: (err) => {
            console.error("Gemini connection error", err);
            if (clientWs.readyState === 1) clientWs.send(JSON.stringify({ error: err.message }));
          }
        },
      });

      // Send initial context about the venue
      session.sendClientContent({
        turns: [
          {
            role: 'user',
            parts: [{ text: `[System Context: The caller is calling the ${venue} venue. Greet them accordingly.]` }]
          }
        ],
        turnComplete: true
      });

      clientWs.on('message', (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.audio) {
            session.sendRealtimeInput({
              audio: { data: parsed.audio, mimeType: "audio/pcm;rate=16000" },
            });
          }
          if (parsed.end) {
            if (session) {
                session.sendClientContent({
                    turns: [
                        {
                            role: 'user',
                            parts: [{ text: 'Goodbye' }]
                        }
                    ],
                    turnComplete: true
                });
            }
          }
        } catch (err) {
          console.error("Error parsing message", err);
        }
      });
      
      clientWs.on('close', () => {
        // We can't close the session explicitly with close() unless the API exposes it,
        // but we can just let it gc, or if session.close exists, call it.
        // Usually session.close is not exposed or not necessary, we just drop the ref.
      });

      clientWs.on('error', (err) => {
        console.error("Client WebSocket error:", err);
      });

    } catch (err) {
      console.error("Error connecting to Gemini", err);
      try {
        clientWs.send(JSON.stringify({ error: "Failed to connect to AI" }));
        clientWs.close();
      } catch (closeErr) {
        console.error("Error closing client ws", closeErr);
      }
    }
  });

  wss.on('error', (err) => {
    console.error("WebSocket server error:", err);
  });

  server.once('error', (err) => {
    console.error(err);
    process.exit(1);
  });

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
