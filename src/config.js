require('dotenv').config();

module.exports = {
  TCP_PORT:   parseInt(process.env.TCP_PORT)  || 5000,
  HTTP_PORT:  parseInt(process.env.HTTP_PORT) || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'changeme',
  DATABASE_URL: process.env.DATABASE_URL,
};
