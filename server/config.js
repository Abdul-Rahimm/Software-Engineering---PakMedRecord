require('dotenv').config({ quiet: true });

const port = process.env.PORT || 3009;

const connection_string = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pakmedrecord';

const jwt_secret = process.env.JWT_SECRET;
if (!jwt_secret) {
    throw new Error('JWT_SECRET is not set. Copy server/.env.example to server/.env and fill it in.');
}

module.exports = { port, connection_string, jwt_secret };
