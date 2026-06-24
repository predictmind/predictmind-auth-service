import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  // JwtModule gives this module its own JwtService so the JwtAuthGuard can be
  // constructed here. ConfigService is global (from ConfigModule.forRoot).
  imports: [JwtModule.register({})],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard],
})
export class UsersModule {}
