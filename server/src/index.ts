import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'startix-api', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`startix-api listening on http://localhost:${PORT}`);
});
