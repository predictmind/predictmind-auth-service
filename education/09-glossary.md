# 9. Glossary (the dictionary)

Quick, simple meanings for every tricky word in these notes. Skim it anytime.

| Word | Simple meaning |
| --- | --- |
| **API** | The menu of things you're allowed to ask a server to do. |
| **Endpoint** | One item on the menu — a specific web address you can call. |
| **Client** | The thing that asks (browser, phone app). |
| **Server** | The program that answers requests. Ours is one. |
| **Request / Response** | The question sent, and the answer sent back. |
| **HTTP method** | The *kind* of action: `GET` (read), `POST` (send/do). |
| **Status code** | A number describing the result: 200 ok, 201 created, 204 done-no-content, 400 bad request, 401 unauthorized, 404 not found, 409 conflict. |
| **JSON** | Labeled text used to send data: `{ "name": "value" }`. |
| **Database** | Where the server stores info so it isn't forgotten. Ours is PostgreSQL. |
| **PostgreSQL** | A popular, free, reliable database. |
| **SQL** | The language databases speak. |
| **ORM** | A translator from our code to SQL. Ours is Prisma. |
| **Prisma** | Our ORM: describe data in `schema.prisma`, it builds tables + a typed client. |
| **Migration** | A saved, numbered database change, so all environments match. |
| **Model** | A description of one type of stored thing (e.g. `User`). |
| **Field** | One piece of data on a model (e.g. `email`). |
| **Enum** | A fixed list of allowed values (e.g. role: USER/ADMIN). |
| **Primary key** | The unique id that identifies a row (`@id`). |
| **UUID** | A long random unique id, hard to guess. |
| **Index** | Like a phone book's tabs — makes lookups fast. |
| **TypeScript** | JavaScript + a safety helmet (types catch mistakes early). |
| **JavaScript** | The programming language of the web. |
| **Type** | What kind of value something is (string, number, boolean...). |
| **Interface** | A description of an object's shape (its fields). |
| **Class** | A blueprint bundling data + actions. |
| **NestJS** | Our framework: a tidy toolbox/frame for building servers. |
| **Framework** | Ready-made structure so you don't build everything from scratch. |
| **Decorator** | A `@label` sticker that gives code special powers Nest understands. |
| **Dependency Injection (DI)** | Asking for the tools you need instead of building them; Nest hands them over. |
| **Dependency** | A thing your code needs to do its job. |
| **Provider** | Something Nest can create and inject (usually a service). |
| **Service** | A class holding logic/actions (our "brain" is `AuthService`). |
| **Controller** | Maps URLs to functions (the "doors"). |
| **Module** | A labeled box grouping related parts and deciding what's shared. |
| **Guard** | A checkpoint that allows or blocks a request (the "bouncer"). |
| **Pipe** | A checkpoint that transforms/validates data before your code sees it. |
| **DTO** | "Data Transfer Object" — a form describing expected input + its rules. |
| **Validation** | Checking incoming data is safe and correct before using it. |
| **Authentication** | Proving *who you are* (login). |
| **Authorization** | Deciding *what you're allowed to do* (roles/permissions). |
| **Hash** | Scrambling something so it can't be un-scrambled (passwords, tokens). |
| **Argon2** | A modern, deliberately-slow password hasher (the recommended one). |
| **Token** | A pass that proves you're logged in, so you don't resend your password. |
| **JWT** | "JSON Web Token" — a signed token holding who you are (our access token). |
| **Access token** | Short-lived pass (15 min) — the theme-park wristband. |
| **Refresh token** | Long-lived, hashed, single-use pass to get new wristbands. |
| **Rotation** | Giving a new refresh token each time and revoking the old one. |
| **Revoke** | To cancel a token early (e.g. on logout). |
| **Payload** | The data carried inside a token (`sub`, `email`, `role`). |
| **async / await** | How we wait for slow jobs without freezing the program. |
| **Promise** | An "I'll get back to you" ticket returned by async functions. |
| **Environment variable** | A setting/secret kept outside the code (in `.env`). |
| **`.env`** | The local file holding real secrets (never committed). |
| **import / export** | Bring code in from / share code with other files. |
| **`extends`** | Inherit everything from another class, then add more. |
| **`implements`** | Promise to provide certain functions. |
| **Ternary** | One-line if/else: `condition ? ifTrue : ifFalse`. |
| **Destructuring** | Pulling fields out of an object into variables. |
| **Regex** | A pattern for matching text (e.g. "digits then s/m/h/d"). |
| **String interpolation** | Dropping a value into text with `${ ... }`. |
| **Linting / ESLint** | Auto-checking code for messy or risky patterns. |
| **Prettier** | Auto-formatting code so it all looks consistent. |
| **CI** | Robots that auto-run lint/test/build every time you push. |
| **CodeQL** | A robot that scans code for security bugs. |
| **Dependabot** | A robot that updates your borrowed tools to safer versions. |
| **Docker** | Packs the app + its environment into a portable box (image). |
| **Image / Container** | The frozen package / a running copy of it. |
| **Node.js** | The program that runs JavaScript outside a browser (on servers). |
| **npm** | Node's tool for downloading packages and running scripts. |
| **Package / dependency** | A bundle of code written by others that we borrow. |
| **Port** | A numbered "door" on a computer where a server listens (ours: 3002). |
| **root / non-root user** | The all-powerful admin vs a limited user; we run as limited for safety. |

That's the whole vocabulary. With these words + the eight lesson files, you can
re-read any line of this service and know exactly what it does and why. 🎓
