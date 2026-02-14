require("dotenv").config();
const mongoose = require('mongoose');

// This variable acts as a cache to prevent multiple connections
let isConnected = false; 

const connectDB = async () => {
  mongoose.set('strictQuery', true);

  if (isConnected) {
    console.log('=> Using existing database connection');
    return;
  }

  try {
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      // Forcing IPv4 prevents DNS resolution hangs in serverless environments
      family: 4, 
      serverSelectionTimeoutMS: 10000, // 10 seconds timeout
      socketTimeoutMS: 45000,         // Close sockets after 45 seconds of inactivity
    });

    isConnected = db.connections[0].readyState;
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    // Don't use process.exit(1) in a serverless function as it kills the whole instance
    throw error; 
  }
};

module.exports = connectDB;