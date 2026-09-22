import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module';

const BLOCKED_PREFIXES = [
  '/backend',
  '/data',
  '/docs',
  '/node_modules',
  '/.git',
  '/.superpowers',
  '/dist',
  '/server.legacy.js',
  '/docker-compose.yml',
  '/package.json',
  '/package-lock.json',
].map((p) => p.toLowerCase());

function isDotfilePath(path: string): boolean {
  return path.split('/').some((segment) => segment.startsWith('.') && segment !== '.');
}

function sensitivePathGuard(req: Request, res: Response, next: NextFunction) {
  let pathname: string;
  try {
    pathname = decodeURIComponent(req.path);
  } catch {
    res.status(403).send('Forbidden');
    return;
  }

  const lower = pathname.toLowerCase();
  const blocked = BLOCKED_PREFIXES.some((prefix) => lower.startsWith(prefix));
  if (blocked || isDotfilePath(pathname)) {
    res.status(403).send('Forbidden');
    return;
  }
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(sensitivePathGuard);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors();
  const port = process.env.PORT || 3000;
  await app.listen(port);
}
void bootstrap();
