const axios = require('axios');

async function testTransaction() {
  try {
    // Create a test transaction
    const response = await axios.post('http://localhost:3000/api/transactions', {
      userId: 1, // Assuming you have a user with ID 1
      amount: 5000, // KES 5000
      currency: 'KES',
      cryptoCurrency: 'btc',
      paymentMethod: 'mobile_money',
      userDetails: {
        walletAddress: '3FZbgi29cpjq2GjdwV8eyHuJJnkLtktZc5' // Sample BTC address
      }
    });

    console.log('Transaction created:', response.data);
    console.log('Complete payment at:', response.data.moonpayUrl);
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testTransaction();