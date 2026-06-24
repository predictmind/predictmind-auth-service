# 📚 PredictMind Auth Service — Learn It Like You're 10

Hello! 👋 These notes explain **everything** we built in this little program, in
the simplest words possible. If you read them in order, you'll understand every
single line of code in this service — what it does, *how* to write it, *why* we
wrote it that way, and whether there was a better option.

Think of this folder as your **textbook**. The code is the finished LEGO model;
these notes are the instruction booklet that shows you how every brick clicks
together.

## How to read this

Read the files in number order:

| # | File | What you'll learn |
| --- | --- | --- |
| 1 | [01-coding-basics.md](01-coding-basics.md) | What is a program, a server, an API, a database. The big picture. |
| 2 | [02-project-and-config-files.md](02-project-and-config-files.md) | The "setup" files (package.json, tsconfig, etc.) and what they do |
| 3 | [03-database-and-prisma.md](03-database-and-prisma.md) | How we store users in a database, line by line |
| 4 | [04-modules-and-dependency-injection.md](04-modules-and-dependency-injection.md) | How the parts of the app find and talk to each other |
| 5 | [05-validation-and-dtos.md](05-validation-and-dtos.md) | How we check that the data people send us is safe and correct |
| 6 | [06-the-auth-brain.md](06-the-auth-brain.md) | The most important file: signup, login, passwords, tokens |
| 7 | [07-guard-controller-and-startup.md](07-guard-controller-and-startup.md) | The doors (routes), the bouncer (guard), and turning the app on |
| 8 | [08-docker-and-running-it.md](08-docker-and-running-it.md) | How we package the app so it runs anywhere |
| 9 | [09-glossary.md](09-glossary.md) | A dictionary of every tricky word |
| 10 | [10-testing-with-swagger.md](10-testing-with-swagger.md) | Pushing the real buttons with Swagger UI at `/api/docs` |
| 11 | [11-profile-and-account.md](11-profile-and-account.md) | Profile + change-password (the Users module) and a real bug we fixed |
| 12 | [12-password-reset.md](12-password-reset.md) | Forgot/reset password, anti-enumeration, single-use tokens, and a 500→401 fix |

## What does this service even do?

This service is the **front desk** of the PredictMind app. Its whole job is to
answer four questions:

1. **"I'm new — make me an account."** (sign up / register)
2. **"It's me — let me in."** (log in)
3. **"Is this really you?"** (check a visitor's pass on every page)
4. **"I'm leaving — forget my pass."** (log out)

That's it. Other services do the trading and charts. This one only handles
**who you are**. In grown-up words, that's called **authentication** (proving
who you are) and a bit of **authorization** (what you're allowed to do).

## A picture of the whole thing

```text
   You (a person)                 The internet
   ┌──────────┐    "sign me up"   ┌──────────────────┐
   │ Web page │ ────────────────▶ │  Auth service    │
   │ / phone  │ ◀──────────────── │  (this program)  │
   └──────────┘   "here's your    └────────┬─────────┘
                   pass (token)"            │ saves/reads
                                            ▼
                                    ┌────────────────┐
                                    │   Database     │
                                    │ (a big box of  │
                                    │  user info)    │
                                    └────────────────┘
```

Ready? Start with [01-coding-basics.md](01-coding-basics.md). 🚀
