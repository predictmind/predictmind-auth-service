# 11. Profile & Account Management (the Users module)

After login, people want to **see and edit their own info** and **change their
password**. That's what the `users` part of the service does. It reuses the
"bouncer" (guard) from file 7 so every one of these doors is protected.

## The three new doors

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/v1/users/profile` | Show *my* profile |
| PUT | `/api/v1/users/profile` | Update my first/last name |
| PUT | `/api/v1/users/password` | Change my password |

`PUT` is a new HTTP method here: it means **"replace/update this thing."** (Reminder:
`GET` = read, `POST` = create/do, `PUT` = update.)

## The input forms (DTOs)

`src/users/dto/update-profile.dto.ts` — both fields optional, so you can update
just one:

```ts
export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
}
```

`src/users/dto/change-password.dto.ts` — you must prove you know the **current**
password, and the **new** one must be strong (12+):

```ts
export class ChangePasswordDto {
  @IsString() @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
}
```

> **Why require the current password to change it?** If someone walks up to an
> already-logged-in computer, they still can't change the password without
> knowing the old one. Defense in depth.

## The worker: `UsersService` (`src/users/users.service.ts`)

```ts
async getProfile(userId: string): Promise<SafeUser> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException("User not found");
  return this.sanitize(user);
}
```

Look up the user; if gone, `404`; otherwise return the **safe** user (no password
hash — same `sanitize` idea as file 6).

```ts
async updateProfile(userId: string, dto: UpdateProfileDto): Promise<SafeUser> {
  const user = await this.prisma.user.update({
    where: { id: userId },
    data: { firstName: dto.firstName, lastName: dto.lastName },
  });
  return this.sanitize(user);
}
```

Update the row. Handy Prisma detail: if a field is `undefined` (not sent), Prisma
**leaves it unchanged** — so sending only `firstName` won't wipe `lastName`.

### The important one: `changePassword`

```ts
async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundException("User not found");

  const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
  if (!valid) throw new UnauthorizedException("Current password is incorrect");

  const passwordHash = await argon2.hash(dto.newPassword);

  await this.prisma.$transaction([
    this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
}
```

Steps:
1. Find the user.
2. Verify the **current** password with Argon2. Wrong → `401`.
3. Hash the **new** password.
4. Do TWO database changes **together** using `$transaction`:
   - set the new password hash, and
   - **revoke every active refresh token** for this user.

> **What is a `$transaction`?** It runs several database changes as **one
> all-or-nothing unit**. Either *both* succeed, or *neither* does. So we can never
> end up in a weird half-state (new password saved but old sessions still alive).
> Think of it as "do all of this, or none of it."

> **Why revoke all sessions on a password change?** If your account was hijacked
> and you change your password, you want the attacker's logged-in session to die
> immediately. Revoking the refresh tokens forces everyone to log in again with
> the new password. We **tested** this: after a password change, the old refresh
> token returns `401`.

## The doors: `UsersController` (`src/users/users.controller.ts`)

```ts
@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("users")
export class UsersController {
```

Notice the guard sits on the **whole class** this time — so *every* route here
requires a valid token. Each method then uses `@CurrentUser()` to know who is
asking and passes `current.sub` (the user id) to the service.

## Wiring: `UsersModule` (and a gotcha we hit)

```ts
@Module({
  imports: [JwtModule.register({})],
  controllers: [UsersController],
  providers: [UsersService, JwtAuthGuard],
})
export class UsersModule {}
```

> 🐛 **A real bug we hit and fixed (great learning moment):** At first, `UsersModule`
> tried to *borrow* the guard from `AuthModule`. On startup Nest crashed with
> *"Can't resolve dependencies of the JwtAuthGuard (?, ConfigService)."* The `?`
> meant it couldn't find **`JwtService`**.
>
> **Why?** A guard used with `@UseGuards(JwtAuthGuard)` is built **inside the module
> that uses it**. `UsersModule` didn't have `JwtService` in its toolbox.
>
> **The fix:** give `UsersModule` its own `JwtModule.register({})` (which provides
> `JwtService`) and list `JwtAuthGuard` in its `providers`. `ConfigService` was
> already available because `ConfigModule` is global. Lesson: **a module must be
> able to build everything it uses** — borrowing across modules needs the
> dependencies to be available too.

Finally, `AppModule` now also imports `UsersModule` so these doors exist.

## What we verified live

With a real database we tested all of it: view profile → update names (no hash
leaked) → change password (`204`) → old session revoked (`401`) → login with the
**new** password works → login with the **old** one fails (`401`) → editing
without a token fails (`401`) → wrong current password fails (`401`). All green. ✅

## Recap

- The **users** module adds protected profile + change-password endpoints.
- Optional DTO fields let you update one thing without wiping others.
- Changing a password verifies the old one, then uses a **`$transaction`** to set
  the new hash **and** revoke all sessions at once (security).
- A module must own (import/provide) every dependency the things it uses need —
  that's why `UsersModule` imports `JwtModule` and provides the guard.

Back to the [index](README.md).
