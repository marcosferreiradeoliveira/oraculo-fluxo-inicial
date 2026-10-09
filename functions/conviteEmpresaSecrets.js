const { defineSecret } = require("firebase-functions/params");

/** Secret Manager em produção; local: functions/.secret.local */
const brevoApiKey = defineSecret("BREVO_API_KEY");

module.exports = { brevoApiKey };
