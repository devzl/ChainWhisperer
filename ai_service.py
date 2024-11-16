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
    # Debug logging
    print("Received request")
    print("Method:", request.method)
    print("Headers:", dict(request.headers))
    print("Data:", request.get_data(as_text=True))

    if request.method == 'OPTIONS':
        response = jsonify({'status': 'ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST')
        return response

    try:
        # Get and validate data
        data = request.get_json(force=True)
        print("Parsed JSON data:", data)

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        message = data.get('message')
        chat_id = data.get('chatId')

        if not message:
            return jsonify({'error': 'No message provided'}), 400

        print(f"Processing message: '{message}' for chat_id: {chat_id}")

        # For now, return a simple response
        # Later we'll integrate the AI components
        response = {
            'response': f"I understand you said: {message}",
            'intent': detect_intent(message),
            'parameters': extract_parameters(message)
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
    return {
        'amount': None,
        'fromToken': None,
        'toToken': None
    }

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    port = 5050
    print(f"Starting AI service on port {port}...")
    app.run(host='0.0.0.0', port=port, debug=True)

