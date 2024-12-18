const axios = require('axios');
require('dotenv').config();
const { privateKeyToAccount } = require("viem/accounts");
const { createNexusClient } = require("@biconomy/sdk");
const { polygonMumbai, baseSepolia } = require("viem/chains");
const { http } = require("viem");
const crypto = require('crypto');
const { SDK, NetworkEnum, getRandomBytes32, HashLock, PrivateKeyProviderConnector } = require("@1inch/cross-chain-sdk");
const Web3 = require('web3');
const { ethers } = require('ethers');
const db = require('./db'); // Import database helper

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;

const INCH_API_KEY = process.env.INCH_API_KEY;
const INCH_API_URL = 'https://api.1inch.dev/swap/v5.2';

const sdk = new SDK({
    url: "https://api.1inch.dev/fusion-plus",
    authKey: INCH_API_KEY, // Ensure you have Fusion+ access
    blockchainProvider: new Web3('https://mainnet.infura.io/v3/' + process.env.INFURA_KEY)
  });

  

const toChecksumAddress = (address) => {
    return ethers.getAddress(address);
};

// const LZ_API_KEY = process.env.LAYERZERO_API_KEY;

// Generate new private key for user
function generatePrivateKey() {
   return crypto.randomBytes(32).toString('hex');
}



const TOKEN_ADDRESSES = {
    'ETH': {
        1: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // ETH on Ethereum (special address in 1inch API)
        137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH on Polygon
        42161: '0x82AF49447D8a07e3bd95BD0d56f35241523FBab1', // WETH on Arbitrum
        10: '0x4200000000000000000000000000000000000006', // WETH on Optimism
        8453: '0x4200000000000000000000000000000000000006', // WETH on Base (same as Optimism)
    },
    'WETH': {
        1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH on Ethereum
        137: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH on Polygon
        42161: '0x82AF49447D8a07e3bd95BD0d56f35241523FBab1', // WETH on Arbitrum
        10: '0x4200000000000000000000000000000000000006', // WETH on Optimism
        8453: '0x4200000000000000000000000000000000000006', // WETH on Base
    },
    'USDC': {
        1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC on Ethereum
        137: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // USDC on Polygon
        42161: '0xFF970A61A04b1Ca14834A43f5DE4533eBdDB5CC8', // USDC on Arbitrum
        10: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC on Optimism
        8453: '0xd9ec4c6af9E2DAf0F6DC60Caa61dAEa23533Fb04', // USDC on Base
    },
    'USDT': {
        1: '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT on Ethereum
        137: '0x3e121107F6F22DA4911079845a470757aF4e1A1b', // USDT on Polygon
        42161: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9', // USDT on Arbitrum
        10: '0x6c3Ea9036406852006290770f83e38133d39c3b8', // USDT on Optimism
        8453: '0x6C3ea9036406852006290770f83e38133D39c3b8', // USDT on Base
    },
    'DAI': {
        1: '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI on Ethereum
        137: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', // DAI on Polygon (Note: This is a wrapped DAI)
        42161: '0xDA10009cBd5D07Dd0CeCc66161FC93D7c9000da1', // DAI on Arbitrum
        10: '0xDA10009cBd5D07Dd0CeCc66161FC93D7c9000da1', // DAI on Optimism
        8453: '0xF8174eFb89eA8EbdD6D1bE1E9eF1646692445eF0', // DAI on Base
    },
    'WBTC': {
        1: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC on Ethereum
        137: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', // WBTC on Polygon
        42161: '0x2f2a2543B76a4166549F7Aaab0cF3eFba4fc85d2', // WBTC on Arbitrum
        10: '0x68f180fcce6836688e9084f035309e29bf0a2095', // WBTC on Optimism
    },
    'MATIC': {
        137: '0x0000000000000000000000000000000000001010', // MATIC on Polygon (special address)
    },
    'LINK': {
        1: '0x514910771AF9Ca656af840dff83E8264EcF986CA', // LINK on Ethereum
        42161: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', // LINK on Arbitrum
        10: '0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6', // LINK on Optimism
    },
    'UNI': {
        1: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // UNI on Ethereum
        137: '0xb33EaAd8d922B1083446DC23f610c2567fB5180f', // UNI on Polygon
        42161: '0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0', // UNI on Arbitrum
        10: '0x6fd9d7AD17242c41f7131d257212c54A0e816691', // UNI on Optimism
    },
    // Add more tokens as needed
};

const TOKEN_DECIMALS = {
    'ETH': 18,
    'WETH': 18,
    'USDC': 6,
    'USDT': 6,
    'DAI': 18,
    'WBTC': 8,
    'MATIC': 18,
    'LINK': 18,
    'UNI': 18,
    // Add other tokens as needed
};


// Chain ID mapping
const CHAIN_IDS = {
    'ethereum': 1,
    'polygon': 137,
    'arbitrum': 42161,
    'optimism': 10,
    'sepolia': 11155111, // Ethereum Sepolia testnet
    'goerli': 5,         // Ethereum Goerli testnet
    'mumbai': 80001,     // Polygon Mumbai testnet
    'flare': 14,         // Flare mainnet
    'coston': 16,        // Flare Coston testnet
};

async function handleSendIntent(aiResponse, chatId) {
    const wallet = await getWallet(chatId);
    if (!wallet) {
        return "You'll need a wallet first! Use /start to create one.";
    }

    const params = aiResponse.parameters;

    if (!params.amount || !params.fromToken || !params.toAddress || !params.toChain) {
        return "Please specify the amount, token, recipient address, and network. Example: 'Send 1.5 USDC to 0x123... on Polygon Mumbai'.";
    }

    // Resolve chain ID
    const chainId = CHAIN_IDS[params.toChain.toLowerCase()];
    if (!chainId) {
        return `Unsupported network: ${params.toChain}. Supported networks include Ethereum, Polygon, Arbitrum, Optimism, Flare, and testnets.`;
    }

    // Resolve token address
    const tokenAddress = TOKEN_ADDRESSES[params.fromToken.toUpperCase()]?.[chainId];
    if (!tokenAddress) {
        return `Unsupported token or chain. Please check the token (${params.fromToken}) and chain (${params.toChain}).`;
    }

    try {
        // Fetch wallet balance for the specified chain
        const balances = await fetchTokenBalancesDirect(wallet.smart_account_address, chainId);
        const tokenBalance = balances.find(b => b.symbol === params.fromToken);

        if (!tokenBalance || parseFloat(tokenBalance.balance) < parseFloat(params.amount)) {
            return `❌ Insufficient ${params.fromToken} balance on ${params.toChain}. Available: ${tokenBalance?.balance || 0}.`;
        }

        return `✅ Please send ${params.amount} ${params.fromToken} to ${params.toAddress} on ${params.toChain}.`;
    } catch (error) {
        console.error('Error in handleSendIntent:', error);
        return `❌ Unable to process your request. Please try again later.`;
    }
}



// Fetch token balances from Blockscout
async function fetchTokenBalances(walletAddress) {
    const url = `https://eth.blockscout.com/api/v2/addresses/${walletAddress}/token-balances`;

    try {
        const response = await axios.get(url);
        return response.data; // Return the token balance data
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`No balances found for wallet ${walletAddress}.`);
            return []; // Return an empty array for no balances
        } else {
            console.error(`Error fetching token balances for ${walletAddress}:`, error.message);
            throw new Error("Unable to fetch token balances. Please try again later.");
        }
    }
}

// Done with BlockScout
async function handleTokenBalancesIntent(chatId, chainName = 'ethereum') {
    const wallet = await getWallet(chatId);
    if (!wallet) {
        return "Please create a wallet first using /start.";
    }

    const walletAddress = wallet.smart_account_address;

    // Map chain name to ID
    const chainId = CHAIN_IDS[chainName.toLowerCase()];
    if (!chainId) {
        return `Unsupported network: ${chainName}. Supported networks include Ethereum, Polygon, Arbitrum, Optimism, Flare, and various testnets.`;
    }

    try {
        const tokenBalances = await fetchTokenBalances(walletAddress, chainId);

        if (tokenBalances.length === 0) {
            return `No tokens found in your wallet on ${chainName}.`;
        }

        // Format response for the user
        let responseText = `💰 Token balances for your wallet ${walletAddress} on ${chainName}:\n`;
        tokenBalances.forEach(({ name, symbol, balance }) => {
            responseText += `- ${name} (${symbol}): ${balance}\n`;
        });

        return responseText;
    } catch (error) {
        return `❌ Error: ${error.message}`;
    }
}


async function fetchTokenBalancesDirect(walletAddress, chainId = 1) {
    try {
        // Initialize provider based on chainId
        const providerUrls = {
            1: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`, // Ethereum Mainnet
            137: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_KEY}`, // Polygon Mainnet
            42161: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`, // Arbitrum
            10: `https://optimism-mainnet.infura.io/v3/${process.env.INFURA_KEY}`, // Optimism
            11155111: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`, // Sepolia Testnet
            5: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`, // Goerli Testnet
            14: `https://flare-api.flare.network/ext/bc/C/rpc`, // Flare Mainnet
            16: `https://coston.flare.network/ext/bc/C/rpc`, // Flare Testnet
        };

        const providerUrl = providerUrls[chainId];
        if (!providerUrl) {
            throw new Error(`Unsupported chainId: ${chainId}`);
        }

        const provider = new ethers.JsonRpcProvider(providerUrl);
        console.log("walletAddress: ", walletAddress, toChecksumAddress(walletAddress));
        // Fetch native token balance (e.g., ETH, MATIC)
        const nativeBalance = await provider.getBalance(toChecksumAddress(walletAddress));

        const tokenBalances = [];
        tokenBalances.push({
            name: "Native Token",
            symbol: chainId === 137 ? "MATIC" : "ETH", // Adjust for the chain
            balance: ethers.formatEther(nativeBalance),
        });

        
        // Add ERC-20 token balances
        const tokens = TOKEN_ADDRESSES; // Your predefined tokens
        for (const [tokenSymbol, chainTokens] of Object.entries(tokens)) {
            const tokenAddress = chainTokens[chainId];
            if (!tokenAddress) continue;

            console.log("tokenAddress: ", tokenAddress, toChecksumAddress(tokenAddress));

            const erc20 = new ethers.Contract(
                toChecksumAddress(tokenAddress),
                ["function balanceOf(address owner) view returns (uint256)"],
                provider
            );

            console.log("walletAddress: ", walletAddress, toChecksumAddress(walletAddress));

            const balance = await erc20.balanceOf(toChecksumAddress(walletAddress));

            tokenBalances.push({
                name: tokenSymbol,
                symbol: tokenSymbol,
                balance: ethers.formatUnits(balance, TOKEN_DECIMALS[tokenSymbol]),
            });
        }

        return tokenBalances;
    } catch (error) {
        console.error(`Error fetching token balances: ${error.message}`);
        throw new Error("Unable to fetch token balances. Please try again later.");
    }
}



// async function handleTokenBalancesIntent(chatId) {
//     const wallet = await getWallet(chatId);
//     if (!wallet) {
//         return "Please create a wallet first using /start.";
//     }

//     const walletAddress = wallet.smart_account_address;

//     try {
//         const tokenBalances = await fetchTokenBalances(walletAddress);

//         if (tokenBalances.length === 0) {
//             return `No tokens found in your wallet on Mainnet: ${walletAddress}.`;
//         }

//         // Format response for the user
//         let responseText = `💰 Token balances for your wallet ${walletAddress} on Mainnet:\n`;
//         tokenBalances.forEach(({ token, value }) => {
//             const name = token?.name || "Unknown";
//             const symbol = token?.symbol || "Unknown";
//             const icon = token?.icon_url || "";
//             responseText += `- ${name} (${symbol}): ${value}\n`;
//             if (icon) {
//                 responseText += `  Icon: ${icon}\n`; // Include icon URL if available
//             }
//         });

//         return responseText;

//     } catch (error) {
//         return `❌ Error: ${error.message}`;
//     }
// }


async function getWallet(chatId) {
    try {
        const result = await db.query(`SELECT * FROM wallets WHERE chat_id = $1`, [chatId]);
        console.log('Fetched wallet from database:', result.rows[0]);
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching wallet from database:', error);
        throw error;
    }
}



// Initialize Biconomy wallet
async function createSmartAccount(chatId) {
    try {
        const privateKey = generatePrivateKey();
        const account = privateKeyToAccount(`0x${privateKey}`);
        
        const bundlerUrl = "https://bundler.biconomy.io/api/v3/84532/nJPK7B3ru.dd7f7861-190d-41bd-af80-6877f74b8f44";

        const nexusClient = await createNexusClient({
            signer: account,
            chain: baseSepolia,
            transport: http(),
            bundlerTransport: http(bundlerUrl),
        });

        const smartAccountAddress = await nexusClient.account.address;

        // Save wallet to database
        const result = await db.query(
            `INSERT INTO wallets (chat_id, smart_account_address, private_key, chain_id) 
             VALUES ($1, $2, $3, $4) 
             ON CONFLICT (chat_id) 
             DO UPDATE SET smart_account_address = $2, private_key = $3, chain_id = $4
             RETURNING *`,
            [chatId, smartAccountAddress, privateKey, baseSepolia.id]
        );

        console.log('Wallet saved to database:', result.rows[0]);
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
        const response = await axios.post(process.env.AI_SERVICE_URL, {
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
        const { quote, params, humanReadableToAmount } = wallet.pendingQuote;
        if (!quote) {
            return "No pending swap to confirm.";
        }

        // Use recommended preset
        const preset = quote.presets?.[quote.recommendedPreset];
        if (!preset) {
            return "❌ Unable to execute swap: Preset information is missing.";
        }

        // Generate secrets for hash lock
        const secretsCount = preset.secretsCount || 1; // Default to 1 if not defined
        const secrets = Array.from({ length: secretsCount }).map(() =>
            '0x' + crypto.randomBytes(32).toString('hex')
        );
        const secretHashes = secrets.map((x) => HashLock.hashSecret(x));

        const hashLock =
            secretsCount === 1
                ? HashLock.forSingleFill(secrets[0])
                : HashLock.forMultipleFills(
                      secretHashes.map((secretHash, i) =>
                          solidityPackedKeccak256(["uint64", "bytes32"], [i, secretHash.toString()])
                      )
                  );

        // Place order using SDK
        const order = await sdk.placeOrder(quote, {
            walletAddress: wallet.smart_account_address,
            hashLock,
            secretHashes,
        });

        // Clear pending quote
        wallet.pendingQuote = null;

        return `✅ Fusion+ Swap executed!\n` +
               `Order ID: ${order.orderHash}\n` +
               `Expected to receive: ${humanReadableToAmount.toFixed(6)} ${params.toToken} on ${params.toChain}`;
    } catch (error) {
        console.error('Error executing Fusion+ swap:', error);
        return "❌ Failed to execute Fusion+ swap. Please try again.";
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
            fromAddress: wallet.smart_account_address
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


async function get1inchFusionQuote(fromChainId, toChainId, fromTokenAddress, toTokenAddress, amount) {
    try {
        const decimals = 18; // Adjust based on token decimals
        const amountInWei = BigInt(Math.floor(amount * (10 ** decimals))).toString();

        const response = await axios.get(`${INCH_API_URL}/fusion-plus/quote`, {
            headers: { 
                'Authorization': `Bearer ${INCH_API_KEY}`,
                'accept': 'application/json'
            },
            params: {
                fromChainId,
                toChainId,
                fromTokenAddress,
                toTokenAddress,
                amount: amountInWei
            }
        });

        if (!response.data || !response.data.toAmount) {
            throw new Error('Invalid response from Fusion+ API');
        }

        return response.data;
    } catch (error) {
        console.error('Error getting Fusion+ quote:', error.response?.data || error);
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
    const wallet = await getWallet(chatId);
    if (!wallet) {
        return "You'll need a wallet first! Use /start to create one.";
    }

    try {
        const params = aiResponse.parameters;

        if (!params.amount || !params.fromToken || !params.toToken || !params.fromChain || !params.toChain) {
            return "Please specify the amount, tokens, and both source and target chains. Example: 'Swap 100 USDC to WETH from Ethereum to Polygon'.";
        }

        if (params.fromChain.toLowerCase() === params.toChain.toLowerCase()) {
            return `Source chain (${params.fromChain}) and destination chain (${params.toChain}) cannot be the same.`;
        }

        const srcChainId = CHAIN_IDS[params.fromChain.toLowerCase()];
        const dstChainId = CHAIN_IDS[params.toChain.toLowerCase()];

        if (!srcChainId || !dstChainId) {
            return `Unsupported chain. Ensure source chain (${params.fromChain}) and destination chain (${params.toChain}) are valid.`;
        }

        const srcTokenAddress = TOKEN_ADDRESSES[params.fromToken.toUpperCase()]?.[srcChainId];
        const dstTokenAddress = TOKEN_ADDRESSES[params.toToken.toUpperCase()]?.[dstChainId];

        if (!srcTokenAddress || !dstTokenAddress) {
            return `Unsupported token or chain. Please check the token (${params.fromToken}, ${params.toToken}) and chain (${params.fromChain}, ${params.toChain}).`;
        }

        const decimals = TOKEN_DECIMALS[params.fromToken.toUpperCase()];
        const amountInWei = BigInt(Math.floor(params.amount * (10 ** decimals))).toString();

        const quote = await sdk.getQuote({
            srcChainId,
            dstChainId,
            srcTokenAddress,
            dstTokenAddress,
            amount: amountInWei,
        });

        const toDecimals = TOKEN_DECIMALS[params.toToken.toUpperCase()];
        const humanReadableToAmount = Number(BigInt(quote.dstTokenAmount) / BigInt(10 ** toDecimals));

        wallet.pendingQuote = {
            quote,
            params,
            humanReadableToAmount,
        };

        return `💱 Cross-Chain Swap Quote received!\n` +
               `Amount: ${params.amount} ${params.fromToken} on ${params.fromChain}\n` +
               `You'll receive: ${humanReadableToAmount.toFixed(6)} ${params.toToken} on ${params.toChain}\n\n` +
               `Reply with 'confirm' to execute the cross-chain swap.`;
    } catch (error) {        
        console.error('Error in swap intent:', error);
        return `❌ Unable to get a cross-chain quote: ${error.message}`;
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
    const wallet = await getWallet(chatId);
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
        'ethereum': NetworkEnum.ETHEREUM,
        'polygon': NetworkEnum.POLYGON,
        'arbitrum': NetworkEnum.ARBITRUM,
        'optimism': NetworkEnum.OPTIMISM,
        'base': 8453 // Update if necessary
    };
    return chainIds[chainName.toLowerCase()] || NetworkEnum.ETHEREUM;
}

function getChainName(chainId) {
    const chainNames = {
        [NetworkEnum.ETHEREUM]: 'Ethereum',
        [NetworkEnum.POLYGON]: 'Polygon',
        [NetworkEnum.ARBITRUM]: 'Arbitrum',
        [NetworkEnum.OPTIMISM]: 'Optimism',
        8453: 'Base' // Update if necessary
    };
    return chainNames[chainId] || 'Unknown';
}


async function handleBalanceIntent(chatId) {
    const wallet = await getWallet(chatId);

   if (!wallet) {
       return "Please use /start to create a wallet first!";
   }
   try {
       const balance = await wallet.nexusClient.getBalance({
           address: wallet.smart_account_address
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
            const wallet = await getWallet(chatId);
            if (!wallet) {
                const smartAccountAddress = await createSmartAccount(chatId);
                responseText = `✅ New wallet created successfully!\n\n` +
                             `Your address: ${smartAccountAddress}\n\n` +
                             `⚠️ Important: This is a test wallet. Do not send significant funds.\n\n` +
                             `You can:\n` +
                             `• Check balance: "What's my token balance?"\n` +
                             `• Swap tokens: "Swap 100 USDC to WETH from Ethereum to Polygon "\n` +
                             `• Bridge assets: "Bridge 0.1 ETH to Polygon"\n` +
                             `• Get quotes: "Price check for 1000 USDT to ETH"`;
            } else {
                responseText = `You already have a wallet: ${wallet.smart_account_address}\n\n` +
                             `What would you like to do?\n` +
                             `• Check token balances\n` +
                             `• Swap and Bridge tokens between chain\n` +
                             `• Get price quotes`;
            }
        } 
        else if (text.toLowerCase() === 'confirm') {
            const wallet = await getWallet(chatId);
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
                case 'token_balances':
                    responseText = await handleTokenBalancesIntent(chatId);
                    break;
                case 'send':
                    responseText = await handleSendIntent(aiResponse, chatId)
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