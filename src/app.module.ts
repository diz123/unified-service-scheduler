import { Module } from '@nestjs/common';
import { SchedulingModule } from './modules/scheduling/scheduling.module';

@Module({
  imports: [SchedulingModule],
})
export class AppModule {}
