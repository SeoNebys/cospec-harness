import pino from 'pino';
export function createLogger(level: string) {
  return pino({
    level,
    redact: {
      paths: ['req.headers.cookie', 'req.headers.authorization', 'password', 'csrf', 'token'],
      censor: '[redacted]'
    }
  });
}
