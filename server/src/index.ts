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
import adminRouter from './routes/admin';
import reportsRouter from './routes/reports';
import paymentsRouter from './routes/payments';
import { stripeWebhook } from './controllers/payments';

const app = express();
const PORT = Number(process.env.PORT) || 5001;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(cookieParser());

// Stripe webhook MUST receive the raw body so we can verify the signature.
// Mounted before express.json() so it bypasses the global JSON parser.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

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
app.use('/api/admin', adminRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/payments', paymentsRouter);

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
