import { json } from '../_lib.js';
// Public configuration for the game client. The Google client ID is not a secret.
export const onRequestGet = ({ env }) => json({ googleClientId: env.GOOGLE_CLIENT_ID && !env.GOOGLE_CLIENT_ID.startsWith('REPLACE') ? env.GOOGLE_CLIENT_ID : null });
