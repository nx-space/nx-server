import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { REDIS } from '~/apps/core/src/app.config';
import { BasicCommer } from '~/shared/commander';

import { registerStdLogger } from '~/shared/global/consola.global';
import { registerGlobal } from '~/shared/global/index.global';
import { readEnv } from '~/shared/utils/rag-env';
import { FriendsServiceModule } from './friends-service.module';

async function bootstrap() {
  registerGlobal();
  registerStdLogger('friends');

  const argv = BasicCommer.parse().opts();
  readEnv(argv, argv.config);

  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    FriendsServiceModule,
    {
      transport: Transport.REDIS,
      options: {
        port: REDIS.port,
        host: REDIS.host,
        password: REDIS.password,
        username: REDIS.user,
      },
    },
  );
  app.listen();
}
bootstrap();
