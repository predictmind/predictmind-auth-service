# 10. Testing It With Swagger

Unit tests (file coming up) check tiny pieces. But we also want to push the real
buttons: send a real "register" request and see a real token come back. The
friendliest tool for that is **Swagger**.

## What is Swagger / OpenAPI?

- **OpenAPI** is a standard way to *describe* an API in a single file (every
  endpoint, what it accepts, what it returns).
- **Swagger UI** is a web page that reads that description and gives you a
  clickable "Try it out" button for every endpoint — so you can test your API
  from the browser, no extra app needed.

> **Why Swagger instead of Postman?** Postman is great, but its request
> collections are *separate* from the code and slowly go out of date. Swagger is
> **generated from our code**, so it's always correct. Bonus: Swagger produces an
> OpenAPI file that you can *import into Postman* if you want both.

## How we turned it on

### 1. We borrowed the tool (`package.json`)

```json
"@nestjs/swagger": "^8.1.0"
```

This is Nest's official Swagger helper.

### 2. We enabled the auto-documenter (`nest-cli.json`)

```json
"compilerOptions": {
  "deleteOutDir": true,
  "plugins": ["@nestjs/swagger"]
}
```

The `@nestjs/swagger` **plugin** reads our DTOs (file 5) automatically and fills
in the docs — so Swagger knows `register` needs an `email` and a `password`
without us writing it twice. Less work, always accurate.

### 3. We set up the docs page (`main.ts`)

```ts
const swaggerConfig = new DocumentBuilder()
  .setTitle("PredictMind Auth Service")
  .setDescription("Authentication, users and RBAC endpoints.")
  .setVersion("0.1.0")
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, swaggerConfig);
SwaggerModule.setup("api/docs", app, document);
```

- `DocumentBuilder()` — builds the description (title, version, etc.).
- `.addBearerAuth()` — tells Swagger "some endpoints need a bearer token," so the
  page shows an **Authorize** button where you paste your access token.
- `SwaggerModule.createDocument(app, ...)` — scans the whole app and builds the
  OpenAPI description.
- `SwaggerModule.setup("api/docs", app, document)` — serve the clickable page at
  `/api/docs`.

### 4. We labelled the controller (`auth.controller.ts`)

```ts
@ApiTags("auth")          // groups these endpoints under an "auth" heading
@Controller("auth")
...
@Get("me")
@ApiBearerAuth()          // marks this one as "needs a token"
@UseGuards(JwtAuthGuard)
```

- `@ApiTags("auth")` — puts all these doors under one tidy "auth" section on the
  page.
- `@ApiBearerAuth()` — shows a little lock on `/me` so you know to authorize first.

## How to actually test (once a database is running)

The service needs a real PostgreSQL to talk to. Once you have one and your `.env`
is filled in:

```bash
npm run prisma:migrate     # create the tables
npm run start:dev          # start the service
```

Then open your browser at:

```text
http://localhost:3002/api/docs
```

You'll see every endpoint. Test the full story like this:

1. **register** → click "Try it out", enter an email + a 12+ char password, Execute.
   You should get back `200` with `user`, `accessToken`, `refreshToken`.
2. Copy the `accessToken`. Click the green **Authorize** button (top right), paste
   it, and confirm. Now you're "wearing the wristband."
3. **GET /auth/me** → Execute. You should see *your* user info (proving the token
   works and the guard let you in).
4. **login** → try the same email/password → you get fresh tokens.
5. **refresh** → paste the `refreshToken` → you get a new pair (and the old refresh
   token is now dead — that's the rotation from file 6).
6. **logout** → paste a `refreshToken` → `204`, and trying to refresh with it again
   now fails. 

If all six behave as described, the service truly works end-to-end. 🎉

## Things to watch for (good learning moments)

- A wrong password should give `401 Invalid credentials` — and notice it does
  **not** tell you whether the email or the password was the problem (on purpose,
  for safety; see file 6).
- Registering the same email twice should give `409` ("already registered").
- Sending a 5-character password should be rejected by the `ValidationPipe`
  (`400`) *before* it even reaches our code (see file 5).

## Recap

- **Swagger** gives us a clickable test page at `/api/docs`, generated from our
  code so it's always accurate (and exportable to Postman).
- We enabled it with the `@nestjs/swagger` package + plugin + a few lines in
  `main.ts`, and tagged the controller.
- To run a live test we need a database; then we walk register → authorize → me →
  login → refresh → logout and watch each behave correctly.

Back to the [index](README.md).
