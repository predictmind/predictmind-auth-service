# 7. Doors, the Bouncer, and Switching On

We have the brain (file 6). Now: how do requests reach it (the **controller** =
doors), how do we protect private doors (the **guard** = bouncer), and how does
the whole app turn on (**main** + **modules**)?

## The Controller — the doors (`src/auth/auth.controller.ts`)

A **controller** maps web addresses (URLs) to functions. Each method is a door
the outside world can knock on.

```ts
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}
```

- `@Controller("auth")` — every door in here lives under `/auth`. Combined with
  the global `/api/v1` prefix (set in `main.ts`), the full path becomes
  `/api/v1/auth/...`.
- The constructor asks for the `AuthService` (the brain from file 6). The
  controller's job is just to take requests and hand them to the brain — it stays
  thin.

```ts
@Post("register")
register(@Body() dto: RegisterDto): Promise<AuthResult> {
  return this.auth.register(dto);
}
```

- `@Post("register")` — this door answers `POST /api/v1/auth/register`.
- `@Body() dto: RegisterDto` — `@Body()` grabs the JSON the client sent and (thanks
  to the ValidationPipe from file 5) checks it against `RegisterDto`. If invalid,
  the client gets a `400` and our function never even runs.
- We just call `this.auth.register(dto)` and return what it gives. Thin door,
  smart brain.

```ts
@Post("login")
@HttpCode(HttpStatus.OK)
login(@Body() dto: LoginDto): Promise<AuthResult> {
  return this.auth.login(dto.email, dto.password);
}
```

- `@HttpCode(HttpStatus.OK)` — by default `POST` returns status `201 Created`.
  Logging in doesn't *create* anything, so we override it to `200 OK`. Small
  detail, but correct manners.

```ts
@Post("refresh")
@HttpCode(HttpStatus.OK)
refresh(@Body() dto: RefreshDto): Promise<AuthResult> {
  return this.auth.refresh(dto.refreshToken);
}

@Post("logout")
@HttpCode(HttpStatus.NO_CONTENT)
async logout(@Body() dto: RefreshDto): Promise<void> {
  await this.auth.logout(dto.refreshToken);
}
```

- `refresh` swaps tokens; returns `200`.
- `logout` returns `@HttpCode(HttpStatus.NO_CONTENT)` = `204`, the standard "done,
  nothing to send back" status.

```ts
@Get("me")
@UseGuards(JwtAuthGuard)
async me(@CurrentUser() current: JwtPayload): Promise<SafeUser> {
  const user = await this.auth.findById(current.sub);
  if (!user) {
    throw new NotFoundException("User not found");
  }
  return user;
}
```

- `@Get("me")` — answers `GET /api/v1/auth/me` ("who am I?").
- `@UseGuards(JwtAuthGuard)` — **this door is protected** by the bouncer (below).
  No valid token → you don't get in.
- `@CurrentUser() current: JwtPayload` — a custom helper that hands us the logged-in
  user info the guard extracted from the token (so we know who's asking).
- We look them up by `current.sub` (their id). If somehow not found, `404`.
  Otherwise return the safe user.

## The Bouncer — `JwtAuthGuard` (`src/auth/jwt-auth.guard.ts`)

A **guard** decides "can this request continue or not?" Ours checks the visitor's
wristband (access token).

```ts
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
```

- `implements CanActivate` — Nest guards must have a `canActivate` function that
  returns `true` (let them in) or throws (block them).
- `context.switchToHttp().getRequest<Request>()` — get the incoming web request
  object so we can read its headers.
- `extractToken(request)` — pull the token out of the request (below). No token →
  `401 Missing bearer token`.
- `jwt.verifyAsync(token, { secret })` — check the token's **signature** with our
  secret. If it was faked or changed, this throws. If it's expired, this throws.
- `request.user = payload` — stash the verified info on the request so the
  controller (via `@CurrentUser()`) can read it.
- `return true` — all good, let them through.
- `catch { throw new UnauthorizedException(...) }` — any verify failure → `401`.

```ts
  private extractToken(request: Request): string | undefined {
    const header = request.headers.authorization;
    if (!header) {
      return undefined;
    }
    const [scheme, value] = header.split(" ");
    return scheme === "Bearer" ? value : undefined;
  }
}
```

Clients send the token in a header like: `Authorization: Bearer eyJhbGc...`.

- `request.headers.authorization` — read that header.
- `header.split(" ")` — split `"Bearer eyJ..."` into `["Bearer", "eyJ..."]`.
- `[scheme, value] = ...` — name the two parts.
- Return the `value` **only if** the scheme is exactly `"Bearer"` (the standard
  word), else `undefined` (no valid token).

## The `@CurrentUser()` helper (`src/auth/current-user.decorator.ts`)

```ts
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.user;
  },
);
```

- `createParamDecorator` lets us invent our own `@Something()` to use on function
  parameters.
- It simply reads `request.user` — the info the guard stashed — and hands it to
  the controller method. Now `@CurrentUser() current` gives us the logged-in user
  cleanly, instead of digging through the raw request every time.

## Teaching TypeScript about `request.user` (`src/types/express.d.ts`)

```ts
import { JwtPayload } from "../auth/auth.service";

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
```

The web request object (from a tool called **Express**) doesn't normally have a
`user` field. We added one in the guard. This file tells TypeScript "hey, a
request *can* have an optional `user` of type `JwtPayload`," so it stops
complaining and gives us autocomplete. This is called **type augmentation** —
politely extending someone else's type. `export {}` just marks the file as a
module so `declare global` works.

## Wiring it up — `AuthModule` (`src/auth/auth.module.ts`)

```ts
@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
```

- `imports: [JwtModule.register({})]` — bring in Nest's JWT tool so `JwtService`
  can be injected here. We pass `{}` (empty) because we provide the secret and
  expiry *per call* in the service, which is flexible.
- `controllers: [AuthController]` — the doors this module owns.
- `providers: [AuthService, JwtAuthGuard]` — the workers this module creates.
- `exports: [AuthService]` — let other modules use the brain if needed.

## The app's main box — `AppModule` (`src/app.module.ts`)

```ts
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

- `ConfigModule.forRoot({ isGlobal: true })` — load the settings/`.env` once and
  make `ConfigService` available **everywhere**.
- `PrismaModule` — the database box (file 4).
- `AuthModule` — everything we just built.
- `controllers: [HealthController]` — a tiny `/health` door that just says "I'm
  alive" (used by monitoring to check the service is up).

`AppModule` is the **root box** that contains all other boxes. When Nest starts,
it opens this box and sets everything up.

## Switching on — `main.ts`

```ts
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );
  const port = process.env.PORT ?? 3002;
  await app.listen(port);
}

void bootstrap();
```

- `bootstrap` is the "power-on" function. (The name is a tradition — "to
  bootstrap" means to start something up.)
- `NestFactory.create(AppModule)` — build the whole app from the root box.
- `setGlobalPrefix("api/v1")` — put `/api/v1` in front of every route (versioning,
  so we can make `/api/v2` later without breaking old clients).
- `useGlobalPipes(new ValidationPipe(...))` — turn on automatic validation for
  every endpoint (file 5).
- `port = process.env.PORT ?? 3002` — use the `PORT` setting if given, otherwise
  default to `3002`. `??` means "if the left side is empty/undefined, use the
  right side."
- `app.listen(port)` — start listening for requests on that port. The server is
  now awake!
- `void bootstrap()` — actually run the power-on function. `void` says "I'm
  intentionally not waiting for this Promise here," which keeps the code-checker
  happy.

## The full journey of one request

```text
POST /api/v1/auth/login  { email, password }
        │
        ▼
 Global ValidationPipe  ── invalid? ─▶ 400 Bad Request
        │ valid
        ▼
 AuthController.login()  ── calls ─▶ AuthService.login()
        │                                  │ checks DB + Argon2
        │                                  ▼
        │                          makes access + refresh tokens
        ▼
 Response 200  { user, accessToken, refreshToken }
```

And a protected request:

```text
GET /api/v1/auth/me   header: Authorization: Bearer <token>
        │
        ▼
 JwtAuthGuard  ── bad/missing token? ─▶ 401 Unauthorized
        │ ok (stashes request.user)
        ▼
 AuthController.me()  ── reads @CurrentUser ─▶ AuthService.findById()
        ▼
 Response 200  { the safe user }
```

## Recap

- The **controller** maps URLs to functions and stays thin (delegates to the
  brain).
- The **guard** protects private routes by verifying the JWT and stashing the user.
- `@CurrentUser()` cleanly hands the logged-in user to controller methods.
- **Modules** group and share parts; `AppModule` is the root; `main.ts` switches
  everything on with the global prefix and validation.

Next: packaging the app to run anywhere →
[08-docker-and-running-it.md](08-docker-and-running-it.md)
