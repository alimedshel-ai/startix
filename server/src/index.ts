import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler, notFound } from './middleware/error';
import { prisma } from './lib/prisma';
import authRouter from './routes/auth';
import diagnosticRouter from './routes/diagnostic';
import departmentsRouter from './routes/departments';
import complianceRouter from './routes/compliance';
import strategicRouter from './routes/strategic';
import companiesRouter from './routes/companies';
import aiRouter from './routes/ai';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());

// Stripe webhooks need the raw body, so register that route before express.json().
// app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'startix-api', timestamp: new Date().toISOString() });
});

app.get('/health/db', async (_req: Request, res: Response, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'reachable' });
  } catch (err) {
    next(err);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/diagnostic', diagnosticRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/compliance', complianceRouter);
app.use('/api/strategic', strategicRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/ai', aiRouter);

app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, () => {
  console.log(`startix-api listening on http://localhost:${PORT}`);
});

async function shutdown(signal: string) {
  console.log(`\n${signal} received — shutting down`);
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
