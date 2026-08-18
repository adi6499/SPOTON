import { serve } from '@hono/node-server';
import app from './dist/server.js';

const port = 3001;

console.log(`Starting Node server on port ${port}...`);

serve({
  fetch: app.fetch,
  port: port,
  hostname: '0.0.0.0'
});
