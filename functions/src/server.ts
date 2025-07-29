import * as functions from 'firebase-functions';
import express from 'express';

const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Export the Express app as a Cloud Function
export const api = functions.https.onRequest(app);
export { app };
