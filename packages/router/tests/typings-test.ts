import express from 'express';
import { createServerAdapter } from '@whatwg-node/server';
import { createRouter } from '../src/index.js';

const router = createRouter();
const adapter = createServerAdapter(() => new Response('Hello World'));

const app = express();
app.use('/router', router);
app.use('/adapter', adapter);
