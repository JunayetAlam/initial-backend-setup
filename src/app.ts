import cors from 'cors';
import express, { Application, NextFunction, Request, Response } from 'express';
import httpStatus from 'http-status';
import cookieParser from 'cookie-parser';
import globalErrorHandler from './app/middlewares/globalErrorHandler';
import router from './app/routes';
import path from 'path';
import { html } from './htmldesign';
import { firebaseLoginHtml } from './firebase-login.html';
import config from './config';

const allowedOrigins = new Set(config.client_origins);

const isAllowedOrigin = (origin?: string) =>
  !origin || allowedOrigins.has(origin.replace(/\/+$/, ''));

const app: Application = express();

// Needed behind a reverse proxy (nginx, Vercel) so req.ip and rate limiting see the real client IP.
app.set('trust proxy', 1);

app.use(
  cors({
    origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
    ],
    optionsSuccessStatus: 200,
  }),
);

app.use(express.json());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));
app.use(cookieParser());

app.get('/', (req: Request, res: Response) => {
  res.send(html(config.project_name || 'Server'));
});

app.get('/firebase-login', (req: Request, res: Response) => {
  res.send(firebaseLoginHtml);
});

app.use('/api/v1', router);

app.use(globalErrorHandler);
app.use('/upload', express.static(path.join(__dirname, 'app', 'upload')));
app.use((req: Request, res: Response, next: NextFunction) => {
  res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: 'API NOT FOUND!',
    error: {
      path: req.originalUrl,
      message: 'Your requested path is not found!',
    },
  });
});

export default app;
