import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { AuthService } from "./auth.service";

type MockPrisma = {
  user: {
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  refreshToken: {
    create: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  passwordResetToken: {
    create: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

describe("AuthService", () => {
  let service: AuthService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: "rt-1" }),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: { signAsync: jest.fn().mockResolvedValue("access-token") } },
        {
          provide: ConfigService,
          useValue: {
            get: (_key: string, fallback?: string) => fallback,
            getOrThrow: () => "test-secret",
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it("registers a new user and returns tokens without the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "trader@example.com",
      passwordHash: "hashed",
      role: "USER",
      status: "ACTIVE",
      emailVerified: false,
      firstName: null,
      lastName: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.register({
      email: "trader@example.com",
      password: "a-very-strong-password",
    });

    expect(result.accessToken).toBe("access-token");
    expect(result.refreshToken).toContain("rt-1.");
    expect(result.user.email).toBe("trader@example.com");
    expect(
      (result.user as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });

  it("rejects registration when the email already exists", async () => {
    prisma.user.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      service.register({
        email: "trader@example.com",
        password: "a-very-strong-password",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not reveal whether an email exists on password reset request", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const result = await service.requestPasswordReset("unknown@example.com");
    expect(result).toEqual({});
    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it("rejects a reset with an invalid token", async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue(null);
    await expect(
      service.resetPassword("missing-id.some-secret", "a-new-strong-password"),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("lists only the user's active sessions (no token data)", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([
      { id: "s1", createdAt: new Date(), expiresAt: new Date() },
    ]);
    const sessions = await service.listSessions("user-1");
    expect(sessions).toHaveLength(1);
    const call = prisma.refreshToken.findMany.mock.calls[0][0];
    expect(call.where.userId).toBe("user-1");
    expect(call.where.revokedAt).toBeNull();
  });

  it("revokes a single session scoped to the owner", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await service.revokeSession("user-1", "session-1");
    const call = prisma.refreshToken.updateMany.mock.calls[0][0];
    expect(call.where.id).toBe("session-1");
    expect(call.where.userId).toBe("user-1");
  });
});
