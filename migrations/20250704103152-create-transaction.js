'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Transactions', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      userId: {
        type: Sequelize.INTEGER
      },
      amount: {
        type: Sequelize.FLOAT
      },
      currency: {
        type: Sequelize.STRING
      },
      cryptoAmount: {
        type: Sequelize.FLOAT
      },
      cryptoCurrency: {
        type: Sequelize.STRING
      },
      status: {
        type: Sequelize.STRING
      },
      paymentMethod: {
        type: Sequelize.STRING
      },
      moonpayTransactionId: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('Transactions');
  }
};