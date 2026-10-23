const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(process.cwd(), '.env'), quiet: true });

const nodeEnv =
  process.env.NODE_ENV === 'production' ? 'production' : 'development';

dotenv.config({
  path: path.join(process.cwd(), `.env.${nodeEnv}`),
  override: true,
  quiet: true,
});

if (!process.env.DATABASE_URL) {
  const slug = process.env.PROJECT_SLUG;
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const port = process.env.POSTGRES_PORT;
  const host = process.env.POSTGRES_HOST || 'localhost';
  if (slug && user && password && port) {
    process.env.DATABASE_URL = `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${slug}?schema=public`;
  }
}
