// Node.js Express Admin Bot Handler logic
const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

const DB_URL = "https://fir-ca8a9-default-rtdb.asia-southeast1.firebasedatabase.app/";
const BOT_TOKEN = "8305788855:AAG-karQ-bBEzBLPgEvAXLNqcLS8jo7FTGQ";

app.post('/telegram-webhook', async (req, res) => {
    const callbackQuery = req.body.callback_query;
    if (callbackQuery) {
        const data = callbackQuery.data; // approve_TXID or reject_TXID
        const txId = data.split('_')[1];
        const action = data.split('_')[0];

        // Fetch Tx Detail
        const txRes = await axios.get(`${DB_URL}/transactions/${txId}.json`);
        const tx = txRes.data;

        if (tx && tx.status === 'pending') {
            if (action === 'approve') {
                // Update Status
                await axios.patch(`${DB_URL}/transactions/${txId}.json`, { status: 'approved' });

                if (tx.type === 'transfer') {
                    // Top-up receiver balance
                    const recUser = await axios.get(`${DB_URL}/users/${tx.receiverPhone}.json`);
                    if (recUser.data) {
                        const updatedBal = (recUser.data.balance || 0) + tx.amount;
                        await axios.patch(`${DB_URL}/users/${tx.receiverPhone}.json`, { balance: updatedBal });
                    }
                } else if (tx.type === 'deposit') {
                    // Top-up sender balance
                    const senderUser = await axios.get(`${DB_URL}/users/${tx.senderPhone}.json`);
                    if (senderUser.data) {
                        const updatedBal = (senderUser.data.balance || 0) + tx.amount;
                        await axios.patch(`${DB_URL}/users/${tx.senderPhone}.json`, { balance: updatedBal });
                    }
                }

                // Edit Telegram Message
                await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id,
                    text: callbackQuery.message.text + "\n\n✅ *အတည်ပြုပြီးပါပြီ*"
                });

            } else if (action === 'reject') {
                await axios.patch(`${DB_URL}/transactions/${txId}.json`, { status: 'rejected' });
                
                // Return Amount if transfer rejected
                if (tx.type === 'transfer') {
                    const senderUser = await axios.get(`${DB_URL}/users/${tx.senderPhone}.json`);
                    const updatedBal = (senderUser.data.balance || 0) + tx.amount;
                    await axios.patch(`${DB_URL}/users/${tx.senderPhone}.json`, { balance: updatedBal });
                }

                await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id,
                    text: callbackQuery.message.text + "\n\n❌ *ငြင်းပယ်လိုက်ပါပြီ*"
                });
            }
        }
    }
    res.sendStatus(200);
});

app.listen(3000, () => console.log('Bot Webhook Server running on port 3000'));
