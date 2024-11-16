// Import the express module
const express = require('express');
const { handleMessage } = require('./messageHandler');
require('dotenv').config();

// Create an instance of an Express application
const app = express();

// Define the port on which the server will listen
const PORT = 4040;

// Use middleware to parse JSON bodies
app.use(express.json());

// Define the route to handle incoming POST requests
app.post('*', async (req, res) => {
    // Log the incoming request body to the console

    try {
        const message = req.body.message;
        console.log('Received POST request:', req.body, message);

        if (message) {
            // Handle the incoming message
            await handleMessage(message);
            res.status(200).send('Message handled');
        } else {
            // If no message is found in the request body
            res.status(400).send('No message found in request');
        }
    } catch (error) {
        console.error('Error handling message:', error);
        res.status(500).send('Error handling message');
    }
});

// Start the server and listen on the specified port
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
