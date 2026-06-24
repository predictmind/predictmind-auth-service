import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { User } from "@prisma/client";
import * as argon2 from "argon2";
import { SafeUser } from "../auth/auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.sanitize(user);
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<SafeUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { firstName: dto.firstName, lastName: dto.lastName },
    });
    return this.sanitize(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    // Change the password and log out every existing session (revoke all
    // refresh tokens) so a stolen session can't survive a password change.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
