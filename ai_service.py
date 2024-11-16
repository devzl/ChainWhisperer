from flask import Flask, request, jsonify
from flask_cors import CORS  # Add this import
from langchain_openai import ChatOpenAI
from cdp_langchain.agent_toolkits import CdpToolkit
from cdp_langchain.utils import CdpAgentkitWrapper
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import HumanMessage
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Get environment variables
CDP_API_KEY_NAME = os.getenv('CDP_API_KEY_NAME')
CDP_API_KEY_PRIVATE_KEY = os.getenv('CDP_API_KEY_PRIVATE_KEY')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Initialize AI components
llm = ChatOpenAI(
    model="gpt-4o-mini",
    api_key=OPENAI_API_KEY
)

cdp = CdpAgentkitWrapper(
    api_key_name=CDP_API_KEY_NAME,
    api_key_private_key=CDP_API_KEY_PRIVATE_KEY
)

cdp_toolkit = CdpToolkit.from_cdp_agentkit_wrapper(cdp)
tools = cdp_toolkit.get_tools()

agent_executor = create_react_agent(
    llm,
    tools=tools,
    state_modifier="You are a helpful agent that helps users with crypto operations."
)

@app.route('/analyze', methods=['POST'])
def analyze_message():
    try:
        data = request.get_json(force=True)
        message = data.get('message')
        chat_id = data.get('chatId')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        # Detect intent and extract parameters
        intent = detect_intent(message)
        params = extract_parameters(message)

        # Response logic for intents
        if intent == 'send':
            if not params['amount'] or not params['fromToken'] or not params['toAddress'] or not params['toChain']:
                return jsonify({'error': 'Missing parameters. Please specify the amount, token, recipient address, and network.'}), 400
            response_text = (
                f"Processing send of {params['amount']} {params['fromToken']} "
                f"to {params['toAddress']} on {params['toChain']}."
            )
        elif intent == 'bridge':
            if not params['amount'] or not params['fromToken'] or not params['toChain']:
                return jsonify({'error': 'Missing parameters. Please specify the amount, token, and destination chain.'}), 400
            response_text = f"Processing bridge of {params['amount']} {params['fromToken']} to {params['toChain']}."
        else:
            response_text = f"I understand you said: {message}"

        return jsonify({'response': response_text, 'intent': intent, 'parameters': params})

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 500

def detect_intent(message):
    """
    Determine the user's intent from the message.
    """
    message = message.lower()

    # Detect "send" intent based on presence of recipient address and keywords
    if "send" in message or "deposit" in message or "transfer" in message:
        if "0x" in message:  # Likely contains an Ethereum address
            return 'send'

    # Detect "bridge" intent
    if any(word in message for word in ['bridge', 'move']):
        return 'bridge'

    # Detect other intents
    if any(phrase in message for phrase in ['my token balances', 'which tokens', 'show tokens', 'token balance']):
        return 'token_balances'
    elif any(word in message for word in ['swap', 'exchange', 'trade']):
        return 'swap'
    elif any(word in message for word in ['balance', 'how much', 'check']):
        return 'balance'

    return 'unknown'

def extract_parameters(message):
    """
    Extract parameters for intents like "send", "swap", or "bridge".
    Handles various message patterns like:
    - "Swap 100 USDC to WETH from Ethereum to Polygon"
    - "Bridge 0.1 ETH to Polygon"
    - "Send 1.5 USDC to 0x123... on Polygon"
    """
    words = message.lower().split()
    params = {
        'amount': None,
        'fromToken': None,
        'toToken': None,
        'fromChain': None,
        'toChain': None,
        'toAddress': None,
    }

    try:
        # First pass: find amount and initial token
        for i, word in enumerate(words):
            # Detect numeric values (amount)
            if word.replace('.', '', 1).isdigit():
                params['amount'] = float(word)
                if i + 1 < len(words):
                    params['fromToken'] = words[i + 1].upper()
                break

        # Second pass: find Ethereum address if present
        for i, word in enumerate(words):
            if word.startswith('0x') and len(word) >= 40:
                params['toAddress'] = word
                
                # Look for chain after address (usually preceded by "on" or "to")
                if i + 2 < len(words) and words[i + 1] in ['on', 'to']:
                    params['toChain'] = words[i + 2].capitalize()
                break

        # Third pass: handle token and chain patterns
        for i, word in enumerate(words):
            # Pattern: "to [TOKEN] from [CHAIN] to [CHAIN]"
            if word == 'to' and i + 1 < len(words):
                next_word = words[i + 1].upper()
                # Check if next word is a known token (you should have a token list)
                if next_word in ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'MATIC', 'LINK', 'UNI']:
                    params['toToken'] = next_word
                # Check if next word is a chain name
                elif next_word.upper() in ['ETHEREUM', 'POLYGON', 'ARBITRUM', 'OPTIMISM', 'BASE']:
                    params['toChain'] = words[i + 1].capitalize()

            # Look for source chain after "from"
            if word == 'from' and i + 1 < len(words):
                params['fromChain'] = words[i + 1].capitalize()

        # If we have toChain but no fromChain, assume Ethereum
        if params['toChain'] and not params['fromChain']:
            params['fromChain'] = 'Ethereum'

        # For bridge operations, if no toToken is specified, use the fromToken
        if not params['toToken'] and params['fromToken'] and 'bridge' in message.lower():
            params['toToken'] = params['fromToken']

    except Exception as e:
        print(f"Error extracting parameters: {str(e)}")

    return params

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = 5050
    print(f"Starting AI service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)

