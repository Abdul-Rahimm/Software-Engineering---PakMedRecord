const port = 3009 || process.env.port;

const connection_string = 'mongodb+srv://test:test@cluster0.m5kvtzt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

module.exports = {port, connection_string};
