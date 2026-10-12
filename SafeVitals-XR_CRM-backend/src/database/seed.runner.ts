import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SeederService } from './seeder.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('SeedRunner');
  logger.log('Starting standalone database seed execution...');
  const app = await NestFactory.createApplicationContext(AppModule);
  const seeder = app.get(SeederService);

  await seeder.seedPermissions();
  await seeder.seedRoles();
  await seeder.seedDepartmentsAndPositions();
  await seeder.seedOrgSettings();
  const res = await seeder.seedInitialAdmin();

  if (res.created) {
    logger.log(`Created initial administrator: ${res.email}`);
  } else {
    logger.log(`Administrator already exists: ${res.email}. Password was NOT modified.`);
  }

  logger.log('Database seed completed successfully!');
  await app.close();
  process.exit(0);
}

bootstrap().catch((err) => {
  console.error('Seed runner failed:', err);
  process.exit(1);
});
