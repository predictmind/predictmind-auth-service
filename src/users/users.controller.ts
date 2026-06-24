import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtPayload, SafeUser } from "../auth/auth.service";
import { CurrentUser } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("profile")
  getProfile(@CurrentUser() current: JwtPayload): Promise<SafeUser> {
    return this.users.getProfile(current.sub);
  }

  @Put("profile")
  updateProfile(
    @CurrentUser() current: JwtPayload,
    @Body() dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    return this.users.updateProfile(current.sub, dto);
  }

  @Put("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser() current: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    await this.users.changePassword(current.sub, dto);
  }
}
