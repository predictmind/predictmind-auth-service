import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User } from "@prisma/client";
import * as argon2 from "argon2";
import { randomBytes } from "crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RegisterDto } from "./dto/register.dto";

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

export type SafeUser = Omit<User, "passwordHash">;

export interface AuthResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException("Email is already registered");
    }

    const passwordHash = await argon2.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
      },
    });

    return this.buildAuthResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const valid = await argon2.verify(user.passwordHash, password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.buildAuthResult(user);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const { id, raw } = this.splitRefreshToken(refreshToken);

    const record = await this.prisma.refreshToken.findUnique({
      where: { id },
      include: { user: true },
    });

    if (
      !record ||
      record.revokedAt ||
      record.expiresAt.getTime() < Date.now()
    ) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const matches = await argon2.verify(record.tokenHash, raw);
    if (!matches) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    // Rotate: revoke the used token, then issue a fresh pair.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });

    return this.buildAuthResult(record.user);
  }

  async logout(refreshToken: string): Promise<void> {
    const { id } = this.splitRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async findById(userId: string): Promise<SafeUser | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return user ? this.sanitize(user) : null;
  }

  private async buildAuthResult(user: User): Promise<AuthResult> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
    });

    const refreshToken = await this.createRefreshToken(user.id);

    return { user: this.sanitize(user), accessToken, refreshToken };
  }

  private async createRefreshToken(userId: string): Promise<string> {
    const raw = randomBytes(48).toString("base64url");
    const tokenHash = await argon2.hash(raw);
    const ttlMs = this.parseDurationMs(
      this.config.get<string>("JWT_REFRESH_TTL", "30d"),
    );
    const expiresAt = new Date(Date.now() + ttlMs);

    const record = await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt } satisfies Prisma.RefreshTokenUncheckedCreateInput,
    });

    return `${record.id}.${raw}`;
  }

  private splitRefreshToken(token: string): { id: string; raw: string } {
    const separator = token.indexOf(".");
    if (separator < 0) {
      throw new UnauthorizedException("Malformed refresh token");
    }
    return {
      id: token.slice(0, separator),
      raw: token.slice(separator + 1),
    };
  }

  private parseDurationMs(value: string): number {
    const match = /^(\d+)([smhd])$/.exec(value.trim());
    if (!match) {
      return 30 * 24 * 60 * 60 * 1000; // default 30 days
    }
    const amount = Number(match[1]);
    const unit = match[2];
    const unitMs: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return amount * unitMs[unit];
  }

  private sanitize(user: User): SafeUser {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }
}
