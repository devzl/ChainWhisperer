const axios = require('axios');
require('dotenv').config();
const { privateKeyToAccount } = require("viem/accounts");
const { createNexusClient } = require("@biconomy/sdk");
const { baseSepolia } = require("viem/chains");
const { http } = require("viem");
const crypto = require('crypto');

// Store wallet connections (should go in a secure db)
const walletConnections = new Map();

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

// Generate new private key for user
function generatePrivateKey() {
    return crypto.randomBytes(32).toString('hex');
}

// Initialize Biconomy wallet
async function createSmartAccount(chatId) {
    try {
        // Generate new private key for this user
        const privateKey = generatePrivateKey();
        console.log(`Generated new wallet for user ${chatId}`);

        const account = privateKeyToAccount(`0x${privateKey}`);
        
        const bundlerUrl = "https://bundler.biconomy.io/api/v3/84532/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44";

        const nexusClient = await createNexusClient({
            signer: account,
            chain: baseSepolia,
            transport: http(),
            bundlerTransport: http(bundlerUrl),
        });

        const smartAccountAddress = await nexusClient.account.address;

        walletConnections.set(chatId, {
            smartAccountAddress,
            nexusClient,
            privateKey // TODO: Store this securely in production
        });

        console.log(`Smart account created: ${smartAccountAddress}`);
        return smartAccountAddress;
    } catch (error) {
        console.error('Error creating smart account:', error);
        throw error;
    }
}

async function handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;

    let responseText;

    try {
        if (text === '/start') {
            // Create new wallet if doesn't exist
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                const smartAccountAddress = await createSmartAccount(chatId);
                responseText = `✅ New wallet created successfully!\n\n` +
                             `Your address: ${smartAccountAddress}\n\n` +
                             `⚠️ Important: This is a test wallet. Do not send significant funds.\n\n` +
                             `Available commands:\n` +
                             `- /balance - Check your balance\n` +
                             `- /swap <amount> <fromToken> <toToken>\n` +
                             `- /bridge <amount> <token> <chain>\n` +
                             `- /export - Get your private key (test only)`;
            } else {
                responseText = `You already have a wallet: ${wallet.smartAccountAddress}\n\n` +
                             `Available commands:\n` +
                             `- /balance - Check your balance\n` +
                             `- /swap <amount> <fromToken> <toToken>\n` +
                             `- /bridge <amount> <token> <chain>\n` +
                             `- /export - Get your private key (test only)`;
            }
        } 
        else if (text === '/balance') {
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                responseText = "Please use /start to create a wallet first!";
            } else {
                try {
                    const balance = await wallet.nexusClient.getBalance({
                        address: wallet.smartAccountAddress
                    });
                    responseText = `💰 Your balance: ${balance} ETH`;
                } catch (error) {
                    console.error('Error getting balance:', error);
                    responseText = "❌ Error getting balance. Please try again.";
                }
            }
        }
        else if (text === '/export') {
            // WARNING: Only for testing! Remove in production!
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                responseText = "Please use /start to create a wallet first!";
            } else {
                responseText = `⚠️ Your private key (test only!):\n${wallet.privateKey}`;
            }
        }
        else if (text.startsWith('/swap')) {
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                responseText = "Please use /start to create a wallet first!";
            } else {
                // Parse swap command
                const parts = text.split(' ');
                if (parts.length !== 4) {
                    responseText = "Usage: /swap <amount> <fromToken> <toToken>";
                } else {
                    responseText = "Swap functionality coming soon!";
                }
            }
        }
        else if (text.startsWith('/bridge')) {
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                responseText = "Please use /start to create a wallet first!";
            } else {
                // Parse bridge command
                const parts = text.split(' ');
                if (parts.length !== 4) {
                    responseText = "Usage: /bridge <amount> <token> <chain>";
                } else {
                    responseText = "Bridge functionality coming soon!";
                }
            }
        } 
        else {
            responseText = "Unknown command. Use /start to see available commands!";
        }

        await axios.post(TELEGRAM_API_URL, {
            chat_id: chatId,
            text: responseText
        });
    } catch (error) {
        console.error('Error handling message:', error);
        
        await axios.post(TELEGRAM_API_URL, {
            chat_id: chatId,
            text: "❌ An error occurred. Please try again."
        });
    }
}

module.exports = { handleMessage };