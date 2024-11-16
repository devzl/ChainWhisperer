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

const AI_SERVICE_URL = 'http://localhost:5000/analyze';

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

// Function to interact with Python AI service
async function analyzeWithAI(message, chatId) {
    console.log('Sending to AI service:', {
        message: message.text,
        chatId: chatId
    });

    try {
        // Fixed URL to match the Python server port (5050)
        const response = await axios.post('http://localhost:5050/analyze', {
            message: message.text || message, // Handle both message object and direct text
            chatId: chatId.toString() // Convert to string just in case
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            // Add timeout to help with debugging
            timeout: 5000
        });
        
        console.log('AI service response:', response.data);
        return response.data;
    } catch (error) {
        // Enhanced error logging
        console.error('Error calling AI service:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data,
            config: {
                url: error.config?.url,
                method: error.config?.method,
                headers: error.config?.headers,
                data: error.config?.data
            }
        });
        
        throw new Error(`AI service error: ${error.message}`);
    }
}

// Intent handlers
async function handleSwapIntent(aiResponse, chatId) {
   const wallet = walletConnections.get(chatId);
   if (!wallet) {
       return "You'll need a wallet first! Use /start to create one.";
   }
   return aiResponse.response;
}

async function handleBridgeIntent(aiResponse, chatId) {
   const wallet = walletConnections.get(chatId);
   if (!wallet) {
       return "You'll need a wallet first! Use /start to create one.";
   }
   return aiResponse.response;
}

async function handleBalanceIntent(chatId) {
   const wallet = walletConnections.get(chatId);
   if (!wallet) {
       return "Please use /start to create a wallet first!";
   }
   try {
       const balance = await wallet.nexusClient.getBalance({
           address: wallet.smartAccountAddress
       });
       return `💰 Your balance: ${balance} ETH`;
   } catch (error) {
       console.error('Error getting balance:', error);
       return "❌ Error getting balance. Please try again.";
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
                            `- /export - Get your private key (test only)\n\n` +
                            `Or just chat with me naturally about what you'd like to do!`;
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
           responseText = await handleBalanceIntent(chatId);
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
           // Natural language processing using AI service
           const aiResponse = await analyzeWithAI(message, chatId);
           
           switch (aiResponse.intent) {
               case 'swap':
                   responseText = await handleSwapIntent(aiResponse, chatId);
                   break;
               case 'bridge':
                   responseText = await handleBridgeIntent(aiResponse, chatId);
                   break;
               case 'balance':
                   responseText = await handleBalanceIntent(chatId);
                   break;
               default:
                   responseText = aiResponse.response;
           }
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