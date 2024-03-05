const port = 3009 || process.env.port;

const connection_string = 'mongodb+srv://PakMedRecord:SEproject@pakmedrecord.htvcls1.mongodb.net/PakMedRecord?retryWrites=true&w=majority&appName=PakMedRecord';

module.exports = {port, connection_string};