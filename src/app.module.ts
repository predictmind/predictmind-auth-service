import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller";
import { AuthController } from "./auth/auth.controller";

@Module({
  imports: [],
  controllers: [HealthController, AuthController],
  providers: [],
})
export class AppModule {}