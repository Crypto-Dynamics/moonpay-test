require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { User, Transaction } = require('./models');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// MoonPay configuration
const MOONPAY_API_KEY = process.env.MOONPAY_API_KEY;
const MOONPAY_BASE_URL = 'https://api.moonpay.com';

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kenya Fiat-to-Crypto API',
      version: '1.0.0',
      description: 'API for purchasing cryptocurrency using fiat currency in Kenya',
      contact: {
        name: 'API Support',
        email: 'support@kenyacrypto.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server'
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            email: { type: 'string', format: 'email', example: 'john@example.com' },
            phone: { type: 'string', example: '+254712345678' },
            idNumber: { type: 'string', example: '12345678' }
          }
        },
        Transaction: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 1 },
            amount: { type: 'number', format: 'float', example: 5000.00 },
            currency: { type: 'string', example: 'KES' },
            cryptoAmount: { type: 'number', format: 'float', example: 0.0012 },
            cryptoCurrency: { type: 'string', example: 'btc' },
            status: { type: 'string', example: 'completed' },
            paymentMethod: { type: 'string', example: 'mobile_money' },
            moonpayTransactionId: { type: 'string', example: 'moonpay_12345' }
          }
        }
      }
    }
  },
  apis: ['./app.js'], // This will pick up the JSDoc annotations below
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * tags:
 *   name: Transactions
 *   description: Crypto purchase transactions
 */
/**
 * @swagger
 * /api/transactions:
 *   post:
 *     summary: Create a new crypto purchase transaction
 *     tags: [Transactions]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - amount
 *               - currency
 *               - cryptoCurrency
 *               - paymentMethod
 *               - userDetails
 *             properties:
 *               userId:
 *                 type: integer
 *                 example: 1
 *               amount:
 *                 type: number
 *                 example: 5000
 *               currency:
 *                 type: string
 *                 example: KES
 *               cryptoCurrency:
 *                 type: string
 *                 example: btc
 *               paymentMethod:
 *                 type: string
 *                 enum: [mobile_money, card_payment]
 *                 example: card_payment
 *               cardDetails:
 *                 type: object
 *                 properties:
 *                   cardNumber:
 *                     type: string
 *                     example: "4242424242424242"
 *                   expiryMonth:
 *                     type: string
 *                     example: "12"
 *                   expiryYear:
 *                     type: string
 *                     example: "2025"
 *                   cvv:
 *                     type: string
 *                     example: "123"
 *                   cardholderName:
 *                     type: string
 *                     example: "John Doe"
 *               userDetails:
 *                 type: object
 *                 properties:
 *                   walletAddress:
 *                     type: string
 *                     example: 3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5
 *     responses:
 *       200:
 *         description: Transaction created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error
 */
app.post('/api/transactions', async (req, res) => {
  try {
    const { userId, amount, currency, cryptoCurrency, paymentMethod, cardDetails, userDetails } = req.body;

    // Validate user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create transaction in our database
    const transaction = await Transaction.create({
      userId,
      amount,
      currency,
      cryptoCurrency,
      status: 'pending',
      paymentMethod
    });

    // Prepare MoonPay payload
    const moonpayPayload = {
      walletAddress: userDetails.walletAddress,
      currencyCode: cryptoCurrency,
      baseCurrencyAmount: amount,
      baseCurrencyCode: currency,
      externalTransactionId: transaction.id.toString(),
      customer: {
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phoneNumber: user.phone,
        externalCustomerId: user.id.toString()
      }
    };

    // Add card details if payment method is card
    if (paymentMethod === 'card_payment' && cardDetails) {
      moonpayPayload.paymentMethod = 'credit_debit_card';
      moonpayPayload.card = {
        number: cardDetails.cardNumber,
        expirationMonth: cardDetails.expiryMonth,
        expirationYear: cardDetails.expiryYear,
        cvc: cardDetails.cvv,
        cardholderName: cardDetails.cardholderName
      };
    } else {
      moonpayPayload.paymentMethod = paymentMethod;
    }

    // Create MoonPay transaction
    const moonpayResponse = await axios.post(
      `${MOONPAY_BASE_URL}/v1/transactions`,
      moonpayPayload,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-KEY': MOONPAY_API_KEY
        }
      }
    );

    // Update our transaction with MoonPay ID
    await transaction.update({
      moonpayTransactionId: moonpayResponse.data.id,
      status: moonpayResponse.data.status
    });

    res.json({
      transaction,
      moonpayUrl: moonpayResponse.data.redirectUrl // URL for user to complete payment
    });
  } catch (error) {
    console.error('Transaction error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Transaction failed', details: error.response?.data || error.message });
  }
});


/**
 * @swagger
 * /api/transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     tags: [Transactions]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: integer
 *         required: true
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Transaction'
 *       404:
 *         description: Transaction not found
 *       500:
 *         description: Server error
 */
app.get('/api/transactions/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    // If we have a MoonPay ID, fetch latest status
    if (transaction.moonpayTransactionId) {
      const moonpayResponse = await axios.get(
        `${MOONPAY_BASE_URL}/v1/transactions/${transaction.moonpayTransactionId}`,
        {
          headers: {
            'X-API-KEY': MOONPAY_API_KEY
          }
        }
      );

      // Update our transaction status
      await transaction.update({
        status: moonpayResponse.data.status,
        cryptoAmount: moonpayResponse.data.cryptoAmount
      });
    }

    res.json(transaction);
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

/**
 * @swagger
 * /api/webhook/moonpay:
 *   post:
 *     summary: MoonPay webhook for transaction updates
 *     tags: [Transactions]
 *     description: This endpoint is called by MoonPay to notify about transaction status changes
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               data:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     description: MoonPay transaction ID
 *                   status:
 *                     type: string
 *                   cryptoAmount:
 *                     type: number
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       500:
 *         description: Error processing webhook
 */
app.post('/api/webhook/moonpay', async (req, res) => {
  try {
    const { data } = req.body;
    const transaction = await Transaction.findOne({
      where: { moonpayTransactionId: data.id }
    });

    if (transaction) {
      await transaction.update({
        status: data.status,
        cryptoAmount: data.cryptoAmount
      });
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error processing webhook');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});