// Vercel serverless: lahat ng request dadaan dito
const app = require('../script/server');
module.exports = (req, res) => app(req, res);
