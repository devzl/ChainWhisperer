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

const INCH_API_KEY = process.env.INCH_API_KEY;
const INCH_API_URL = 'https://api.1inch.dev/swap/v5.2';
// const LZ_API_KEY = process.env.LAYERZERO_API_KEY;

// const AI_SERVICE_URL = 'http://localhost:5000/analyze';

// Generate new private key for user
function generatePrivateKey() {
   return crypto.randomBytes(32).toString('hex');
}

// Token address mapping
const TOKEN_ADDRESSES = {
    // Mainnet addresses
    'ETH': '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // Special ETH address for 1inch
    'USDC': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
    'USDT': '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
    'WETH': '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
    'DAI': '0x6B175474E89094C44Da98b954EedeAC495271d0F',  // DAI on Ethereum
    // Add more tokens as needed
};

// Chain ID mapping
const CHAIN_IDS = {
    'ethereum': 1,
    'polygon': 137,
    'arbitrum': 42161,
    'optimism': 10,
    'base': 8453
};

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


async function handleSwapConfirmation(wallet, chatId) {
    try {
        const quote = wallet.pendingQuote;
        if (!quote) {
            return "No pending swap to confirm.";
        }

        // Execute the swap using 1inch
        const swapResponse = await axios.post(`${INCH_API_URL}/1/swap`, {
            fromTokenAddress: quote.fromToken,
            toTokenAddress: quote.toToken,
            amount: quote.fromTokenAmount,
            fromAddress: wallet.smartAccountAddress,
            slippage: 1 // 1% slippage tolerance
        }, {
            headers: { 'Authorization': `Bearer ${INCH_API_KEY}` }
        });

        // Execute the transaction using the wallet
        const tx = await wallet.nexusClient.sendTransaction({
            to: swapResponse.data.tx.to,
            data: swapResponse.data.tx.data,
            value: swapResponse.data.tx.value
        });

        // Clear the pending quote
        wallet.pendingQuote = null;

        return `✅ Swap executed!\n` +
               `Transaction hash: ${tx.hash}\n` +
               `Expected to receive: ${quote.toTokenAmount} ${quote.toToken}`;
    } catch (error) {
        console.error('Error executing swap:', error);
        return "❌ Failed to execute swap. Please try again.";
    }
}

async function handleBridgeConfirmation(wallet, chatId) {
    try {
        const bridge = wallet.pendingBridge;
        if (!bridge) {
            return "No pending bridge transfer to confirm.";
        }

        // Execute the bridge using 1inch Fusion+
        const bridgeResponse = await axios.post(`${INCH_API_URL}/fusion-plus/bridge`, {
            fromChainId: bridge.fromChainId,
            toChainId: bridge.toChainId,
            fromTokenAddress: bridge.fromToken,
            toTokenAddress: bridge.toToken,
            amount: bridge.amount,
            fromAddress: wallet.smartAccountAddress
        }, {
            headers: { 'Authorization': `Bearer ${INCH_API_KEY}` }
        });

        // Execute the transaction using LayerZero
        const tx = await sendCrossChainMessage(
            bridge.fromChainId,
            bridge.toChainId,
            bridgeResponse.data.message,
            wallet
        );

        // Clear the pending bridge
        wallet.pendingBridge = null;

        return `✅ Bridge transfer initiated!\n` +
               `Transaction hash: ${tx.hash}\n` +
               `Expected completion time: 3-5 minutes`;
    } catch (error) {
        console.error('Error executing bridge:', error);
        return "❌ Failed to execute bridge transfer. Please try again.";
    }
}


async function get1inchFusionQuote(fromChainId, toChainId, fromToken, toToken, amount) {
    try {
        const response = await axios.get(`${INCH_API_URL}/fusion-plus/quote`, {
            headers: { 'Authorization': `Bearer ${INCH_API_KEY}` },
            params: {
                fromChainId,
                toChainId,
                fromTokenAddress: fromToken,
                toTokenAddress: toToken,
                amount
            }
        });
        return response.data;
    } catch (error) {
        console.error('Error getting Fusion+ quote:', error);
        throw error;
    }
}

// LayerZero Integration
async function sendCrossChainMessage(fromChainId, toChainId, message, wallet) {
    try {
        // Initialize LayerZero client with wallet
        const response = await wallet.nexusClient.send({
            destination: toChainId,
            message: message,
            options: {
                gasLimit: 200000,
            }
        });
        return response;
    } catch (error) {
        console.error('Error sending cross-chain message:', error);
        throw error;
    }
}

async function handleSwapIntent(aiResponse, chatId) {
    const wallet = walletConnections.get(chatId);
    if (!wallet) {
        return "You'll need a wallet first! Use /start to create one.";
    }

    try {
        const params = aiResponse.parameters;
        if (!params.amount || !params.fromToken || !params.toToken) {
            return "Please specify the amount and tokens. For example: 'Swap 100 USDC to ETH'";
        }

        // Check if tokens are supported
        if (!TOKEN_ADDRESSES[params.fromToken] || !TOKEN_ADDRESSES[params.toToken]) {
            return `Unsupported token. Supported tokens: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`;
        }

        // Get quote from 1inch
        const quote = await get1inchQuote(
            params.fromToken,
            params.toToken,
            params.amount,
            1 // Default to Ethereum mainnet
        );

        console.log('Processing quote:', quote);  // Debug log

        if (!quote || !quote.toAmount) {  // Changed from toTokenAmount to toAmount
            throw new Error('Invalid quote received from 1inch');
        }

        // Store quote for later confirmation
        wallet.pendingQuote = {
            ...quote,
            fromToken: params.fromToken,
            toToken: params.toToken,
            fromTokenAddress: TOKEN_ADDRESSES[params.fromToken],
            toTokenAddress: TOKEN_ADDRESSES[params.toToken],
            fromAmount: params.amount
        };

        // Convert amounts to human-readable format
        // const fromDecimals = params.fromToken === 'USDC' ? 6 : 18;
        const toDecimals = params.toToken === 'USDC' ? 6 : 18;
        
        // Parse the toAmount as a BigInt and convert to number
        const toAmountBig = BigInt(quote.toAmount);  // Changed from toTokenAmount to toAmount
        const humanReadableToAmount = Number(toAmountBig) / (10 ** toDecimals);
        
        // Calculate rate
        const rate = humanReadableToAmount / params.amount;

        console.log('Quote calculation:', {  // Debug log
            toAmount: quote.toAmount,
            humanReadableToAmount,
            rate
        });

        return `💱 Quote received!\n` +
               `Amount: ${params.amount} ${params.fromToken}\n` +
               `You'll receive: ${humanReadableToAmount.toFixed(6)} ${params.toToken}\n` +
               `Rate: 1 ${params.fromToken} = ${rate.toFixed(6)} ${params.toToken}\n` +
               `Network: Ethereum\n\n` +
               `Reply with 'confirm' to execute the swap`;
    } catch (error) {
        console.error('Error in swap intent:', error);
        if (error.response?.data?.description) {
            return `❌ Error: ${error.response.data.description}`;
        }
        return `❌ Sorry, I couldn't get a quote: ${error.message}`;
    }
}

// Updated quote function with proper response handling
async function get1inchQuote(fromToken, toToken, amount, chainId = 1) {
    try {
        const fromTokenAddress = TOKEN_ADDRESSES[fromToken.toUpperCase()];
        const toTokenAddress = TOKEN_ADDRESSES[toToken.toUpperCase()];

        if (!fromTokenAddress || !toTokenAddress) {
            throw new Error(`Unsupported token. Supported tokens: ${Object.keys(TOKEN_ADDRESSES).join(', ')}`);
        }

        // Convert amount to proper decimals
        const decimals = fromToken.toUpperCase() === 'USDC' ? 6 : 18;
        const amountInWei = BigInt(Math.floor(amount * (10 ** decimals))).toString();

        console.log('Requesting 1inch quote with params:', {
            fromTokenAddress,
            toTokenAddress,
            amount: amountInWei,
            chainId
        });

        const response = await axios.get(`${INCH_API_URL}/${chainId}/quote`, {
            headers: { 
                'Authorization': `Bearer ${INCH_API_KEY}`,
                'accept': 'application/json'
            },
            params: {
                fromTokenAddress,
                toTokenAddress,
                amount: amountInWei
            }
        });

        console.log('1inch response:', response.data);
        
        if (!response.data || !response.data.toAmount) {
            throw new Error('Invalid response from 1inch API');
        }

        return response.data;
    } catch (error) {
        console.error('Error getting 1inch quote:', error.response?.data || error);
        throw error;
    }
}


async function handleBridgeIntent(aiResponse, chatId) {
    const wallet = walletConnections.get(chatId);
    if (!wallet) {
        return "You'll need a wallet first! Use /start to create one.";
    }

    try {
        const params = aiResponse.parameters;
        if (!params.amount || !params.token || !params.toChain) {
            return "Please specify the amount, token, and destination chain. For example: 'Bridge 0.1 ETH to Polygon'";
        }

        // Get Fusion+ quote for cross-chain transfer
        const quote = await get1inchFusionQuote(
            1, // From Ethereum
            getChainId(params.toChain),
            params.token,
            params.token,
            params.amount
        );

        // Store bridge quote
        wallet.pendingBridge = quote;

        return `🌉 Bridge quote received!\n` +
               `Amount: ${params.amount} ${params.token}\n` +
               `From: Ethereum\n` +
               `To: ${params.toChain}\n` +
               `Estimated time: ~3-5 minutes\n` +
               `Gas estimate: ${quote.estimatedGas}\n\n` +
               `Reply with 'confirm' to proceed with the bridge`;
    } catch (error) {
        console.error('Error in bridge intent:', error);
        return "❌ Sorry, I couldn't process the bridge request. Please try again.";
    }
}

// Helper function for chain IDs
function getChainId(chainName) {
    const chainIds = {
        'ethereum': 1,
        'polygon': 137,
        'arbitrum': 42161,
        'optimism': 10,
        'base': 8453
    };
    return chainIds[chainName.toLowerCase()] || 1;
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

// Main message handler
async function handleMessage(message) {
    const chatId = message.chat.id;
    const text = message.text;

    let responseText;

    try {
        if (text === '/start') {
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                const smartAccountAddress = await createSmartAccount(chatId);
                responseText = `✅ New wallet created successfully!\n\n` +
                             `Your address: ${smartAccountAddress}\n\n` +
                             `⚠️ Important: This is a test wallet. Do not send significant funds.\n\n` +
                             `You can:\n` +
                             `• Check balance: "What's my balance?"\n` +
                             `• Swap tokens: "Swap 100 USDC to ETH"\n` +
                             `• Bridge assets: "Bridge 0.1 ETH to Polygon"\n` +
                             `• Get quotes: "Price check for 1000 USDT to ETH"`;
            } else {
                responseText = `You already have a wallet: ${wallet.smartAccountAddress}\n\n` +
                             `What would you like to do?\n` +
                             `• Check balance\n` +
                             `• Swap tokens\n` +
                             `• Bridge assets\n` +
                             `• Get price quotes`;
            }
        } 
        else if (text.toLowerCase() === 'confirm') {
            const wallet = walletConnections.get(chatId);
            if (!wallet) {
                responseText = "Please create a wallet first using /start";
            } 
            else if (wallet.pendingQuote) {
                responseText = await handleSwapConfirmation(wallet, chatId);
            } 
            else if (wallet.pendingBridge) {
                responseText = await handleBridgeConfirmation(wallet, chatId);
            } 
            else {
                responseText = "No pending transactions to confirm.";
            }
        }
        else {
            // Use AI service for intent detection and parameter extraction
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