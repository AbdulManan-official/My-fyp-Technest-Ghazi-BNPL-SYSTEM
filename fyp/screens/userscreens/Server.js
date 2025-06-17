// server.js - PKR Only Version
require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const cors = require('cors');

// --- Stripe Initialization ---
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
    console.error("Error: STRIPE_SECRET_KEY is not set in the environment variables.");
    console.error("Please create a .env file and add your Stripe Secret Key.");
    process.exit(1); // Exit if the key is missing
}
const stripe = require('stripe')(stripeSecretKey);

// --- Express App Setup ---
const app = express();

// --- Middleware ---
app.use(cors()); // Configure appropriately for production
app.use(express.json()); // Parse JSON request bodies

// --- Constants ---
const TARGET_CURRENCY = 'pkr'; // Hardcoded currency
const CENTS_MULTIPLIER = 100; // 100 Paisa in 1 Rupee
const MINIMUM_CHARGE_AMOUNT_PAISA = 50; // Stripe's minimum is often around 0.50 units (50 Paisa for PKR) - check Stripe docs for exact current minimum

// --- Routes ---
app.get('/', (req, res) => {
    res.send(`Stripe Payment Server (PKR Only) is running!`);
});

/**
 * @route POST /create-payment-intent
 * @desc Creates a Stripe Payment Intent specifically for PKR.
 *       Accepts the amount in Rupees. Converts it to Paisa automatically.
 * @access Public (consider authentication in a real app)
 *
 * @body {
 *   "amount": number // Amount in Pakistani Rupees (e.g., 150.75 for ₨ 150.75)
 *   // Optional: "customerId": string
 * }
 *
 * @returns {
 *   "clientSecret": string,
 *   "publishableKey": string
 * }
 * or
 * @returns { "error": string }
 */
app.post('/create-payment-intent', async (req, res) => {
    // Amount received from the client (EXPECTED to be in PKR Rupees)
    const { amount: amountInRupees, customerId } = req.body;

    // --- Input Validation ---
    if (typeof amountInRupees !== 'number') {
         return res.status(400).send({ error: 'Invalid or missing amount provided. Amount must be a number representing Pakistani Rupees.' });
    }
    if (amountInRupees <= 0) {
        return res.status(400).send({ error: 'Invalid amount provided. Amount must be a positive number representing Pakistani Rupees.' });
    }


    try {
        // --- >>> PKR CONVERSION <<< ---
        // Convert the amount from Rupees to Paisa
        const amountInPaisa = Math.round(amountInRupees * CENTS_MULTIPLIER);

        // --- Minimum Amount Check ---
        if (amountInPaisa < MINIMUM_CHARGE_AMOUNT_PAISA) {
            console.warn(`Attempted charge of ${amountInPaisa} Paisa is below the minimum threshold of ${MINIMUM_CHARGE_AMOUNT_PAISA} Paisa.`);
            return res.status(400).send({ error: `Amount is too small to process. Minimum charge is approximately ${(MINIMUM_CHARGE_AMOUNT_PAISA / CENTS_MULTIPLIER).toFixed(2)} PKR.` });
        }

        console.log(`Request received: Charge ${amountInRupees} PKR`);
        console.log(`Processing amount: ${amountInPaisa} Paisa (PKR)`);
         if (customerId) {
            console.log(`Using Stripe Customer ID: ${customerId}`);
         }

        // --- Create PaymentIntent (using PKR and Paisa amount) ---
        const params = {
            amount: amountInPaisa,              // Use the calculated Paisa amount
            currency: TARGET_CURRENCY,          // Use the hardcoded 'pkr'
            automatic_payment_methods: { enabled: true },
             ...(customerId && { customer: customerId }), // Add customer if provided
            // metadata: { original_amount_rupees: amountInRupees }, // Optional: Store original value if needed
        };

        const paymentIntent = await stripe.paymentIntents.create(params);

        console.log(`PKR PaymentIntent created: ${paymentIntent.id}, Status: ${paymentIntent.status}`);

        // --- Send Response to Client ---
        res.send({
            clientSecret: paymentIntent.client_secret,
            publishableKey: process.env.STRIPE_PUBLISHABLE_KEY // Needed by the mobile SDK
        });

    } catch (error) {
        console.error("Error creating PKR PaymentIntent:", error.message);
        res.status(500).send({ error: `Internal Server Error: ${error.raw?.message || error.message}` });
    }
});


// --- Start Server ---
const port = process.env.PORT || 4242;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
    console.log(`Mode: PKR Payments Only`);
    console.log(`Publishable Key: ${process.env.STRIPE_PUBLISHABLE_KEY ? 'Loaded' : 'MISSING!'}`);
    console.log('Endpoints:');
    console.log(`  GET  /`);
    console.log(`  POST /create-payment-intent (expects 'amount' in PKR Rupees)`);
});