import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/service-ia-AndreClaveria',
  jwtSecret: process.env.JWT_SECRET || 'your-secret-key'
};
