import { NotFoundException, UnauthorizedException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "./users.service";

// Replace the real argon2 with fakes so tests are fast and predictable.
jest.mock("argon2", () => ({
  verify: jest.fn(),
  hash: jest.fn(),
}));
import * as argon2 from "argon2";

type MockPrisma = {
  user: { findUnique: jest.Mock; update: jest.Mock };
  refreshToken: { updateMany: jest.Mock };
  $transaction: jest.Mock;
};

const fakeUser = {
  id: "user-1",
  email: "trader@example.com",
  passwordHash: "stored-hash",
  role: "USER",
  status: "ACTIVE",
  emailVerified: false,
  firstName: null,
  lastName: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("UsersService", () => {
  let service: UsersService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn() },
      refreshToken: { updateMany: jest.fn() },
      $transaction: jest.fn().mockResolvedValue([]),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get<UsersService>(UsersService);
  });

  it("returns a profile without the password hash", async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser);
    const profile = await service.getProfile("user-1");
    expect(profile.email).toBe("trader@example.com");
    expect(
      (profile as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
  });

  it("throws when the profile is missing", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.getProfile("nope")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("rejects a password change when the current password is wrong", async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser);
    (argon2.verify as jest.Mock).mockResolvedValue(false);

    await expect(
      service.changePassword("user-1", {
        currentPassword: "wrong",
        newPassword: "a-new-strong-password",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("changes the password and revokes sessions when current password is correct", async () => {
    prisma.user.findUnique.mockResolvedValue(fakeUser);
    (argon2.verify as jest.Mock).mockResolvedValue(true);
    (argon2.hash as jest.Mock).mockResolvedValue("new-hash");

    await service.changePassword("user-1", {
      currentPassword: "right",
      newPassword: "a-new-strong-password",
    });

    expect(prisma.user.update).toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
