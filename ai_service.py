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

@app.route('/analyze', methods=['POST', 'OPTIONS'])
def analyze_message():
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        data = request.get_json(force=True)
        print("Parsed JSON data:", data)

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        message = data.get('message')
        chat_id = data.get('chatId')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        print(f"Processing message: '{message}' for chat_id: {chat_id}")

        # Get intent and parameters
        intent = detect_intent(message)
        params = extract_parameters(message)

        # Create appropriate response based on intent and parameters
        if intent == 'swap':
            if params['amount'] and params['fromToken'] and params['toToken']:
                response_text = f"Processing swap of {params['amount']} {params['fromToken']} to {params['toToken']}"
            else:
                response_text = "Please specify the amount and tokens. For example: 'Swap 100 USDC to ETH'"
        elif intent == 'bridge':
            if params['amount'] and params['fromToken'] and params['toChain']:
                response_text = f"Processing bridge of {params['amount']} {params['fromToken']} to {params['toChain']}"
            else:
                response_text = "Please specify the amount, token, and destination chain. For example: 'Bridge 0.1 ETH to Polygon'"
        else:
            response_text = f"I understand you said: {message}"

        response = {
            'response': response_text,
            'intent': intent,
            'parameters': params
        }

        print("Sending response:", response)
        return jsonify(response)

    except Exception as e:
        print(f"Error processing request: {str(e)}")
        return jsonify({'error': str(e)}), 500

def detect_intent(message):
    message = message.lower()
    if any(word in message for word in ['balance', 'how much', 'check']):
        return 'balance'
    elif any(word in message for word in ['swap', 'exchange', 'trade']):
        return 'swap'
    elif any(word in message for word in ['bridge', 'transfer', 'send']):
        return 'bridge'
    return 'unknown'

def extract_parameters(message):
    """
    Extract swap/bridge parameters from the message.
    Example inputs:
    - "Swap 100 USDC to ETH"
    - "Bridge 0.1 ETH to Polygon"
    """
    words = message.lower().split()
    params = {
        'amount': None,
        'fromToken': None,
        'toToken': None,
        'toChain': None  # for bridge operations
    }
    
    try:
        # Find amount and tokens
        for i, word in enumerate(words):
            # Look for numbers (including decimals)
            if word.replace('.', '').isdigit():
                params['amount'] = float(word)
                # Next word is usually the token
                if i + 1 < len(words):
                    params['fromToken'] = words[i + 1].upper()
            
            # Look for "to" and get the next word
            if word == 'to' and i + 1 < len(words):
                next_word = words[i + 1].upper()
                # Check if it's a chain or a token
                if next_word in ['POLYGON', 'ETHEREUM', 'ARBITRUM', 'OPTIMISM', 'BASE']:
                    params['toChain'] = next_word
                else:
                    params['toToken'] = next_word

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

