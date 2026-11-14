import 'dotenv/config';
import { JsonLogger } from './common/json.logger';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap';
import { validateEnvironment } from './config/environment';
async function bootstrap() {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { logger: new JsonLogger() });
  const config = configureApp(app);
  await app.listen(config.port);
}
void bootstrap().catch(() => {
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'startup_failed',
      message: 'Check environment and database connectivity',
    }),
  );
  process.exitCode = 1;
});
