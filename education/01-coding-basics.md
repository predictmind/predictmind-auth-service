# 1. Coding Basics (the big picture)

Before we read our code, let's learn the words grown-up programmers use. Each one
has a simple meaning. I'll use real-life examples (analogies) so they stick.

## What is a program?

A **program** is just a list of instructions you give a computer, like a recipe.
The computer follows the steps exactly. Our program's recipe is: "when someone
asks to sign up, save their details and give them a pass."

## Client and Server

- A **client** is the thing that *asks* for something. Your web browser or phone
  app is a client. Like a customer at a restaurant.
- A **server** is the thing that *answers*. It's a program running on a computer
  somewhere, waiting for questions. Like the kitchen in the restaurant.

Our auth service is a **server**. It sits quietly and waits for clients to ask
it things.

## Request and Response

When a client talks to a server, it sends a **request** ("please log me in") and
the server sends back a **response** ("ok, here's your pass" or "wrong
password"). Like ordering food (request) and getting your plate (response).

## API and endpoints

**API** stands for *Application Programming Interface*. Scary words, simple idea:
it's the **menu** of things you're allowed to ask the server to do. Each item on
the menu is called an **endpoint** — a specific web address you can send a
request to.

Our menu (API) has these items (endpoints):

- `POST /api/v1/auth/register` → "make me an account"
- `POST /api/v1/auth/login` → "let me in"
- `GET  /api/v1/auth/me` → "who am I?"

`GET` and `POST` are **HTTP methods** — they say what *kind* of action it is:
- **GET** = "give me information" (you're just looking).
- **POST** = "here's some information, do something with it" (you're sending data).

## JSON — how computers pass notes

Computers send data to each other as **JSON** (say: "jay-son"). It's just text
with labels, like a filled-in form:

```json
{
  "email": "trader@example.com",
  "password": "super-secret"
}
```

Curly braces `{ }` hold a group of things. Each thing has a **name** (`"email"`)
and a **value** (`"trader@example.com"`). That's 90% of JSON right there.

## Database — the giant labeled box

A **database** is where the server keeps information so it isn't forgotten when
the program turns off. Imagine a giant filing cabinet with labeled drawers.

Our database is **PostgreSQL** (people say "post-gress"). It's a popular, free,
very reliable database. We keep a drawer called `users` with one folder per
person.

> **Why PostgreSQL and not something else?** It's free, trusted by huge companies,
> and great at keeping data safe and correct. Other choices exist (MySQL, MongoDB),
> but Postgres is the best all-rounder for our kind of app.

## TypeScript — the language we write in

We write our code in **TypeScript**. It's **JavaScript** (the language of the
web) plus a safety helmet. TypeScript makes you say what *type* each thing is —
"this is text", "this is a number" — and warns you *before* you run the program
if you make a silly mistake (like putting a number where text should go).

> **Why TypeScript and not plain JavaScript?** The safety helmet catches bugs
> early, while you type, instead of after users hit them. In a big project with
> many files and people, that saves a huge amount of pain.

## NestJS — the toolbox / building frame

**NestJS** (we just call it "Nest") is a **framework** — a ready-made frame and
toolbox for building servers, so we don't build everything from scratch. It's
like getting a LEGO baseplate and special pieces instead of carving bricks
yourself. Nest gives us tidy ways to make endpoints, organize code, and plug
parts together.

> **Why Nest?** It keeps big apps organized and tidy, works perfectly with
> TypeScript, and is very popular so there's lots of help online. Alternatives
> like Express are simpler but you have to organize everything yourself; for a
> serious multi-service app, Nest's structure is worth it.

## The terminal

The **terminal** (or "command line") is a text window where you type commands to
the computer instead of clicking buttons. For example `npm install` tells the
computer "download the tools my project needs." It looks old-fashioned but it's
fast and precise.

## Quick recap

- **Client** asks, **server** answers, using **requests** and **responses**.
- The **API** is the menu of allowed requests; each item is an **endpoint**.
- Data travels as **JSON** (labeled text).
- A **database** remembers information; ours is **PostgreSQL**.
- We write in **TypeScript** (safer JavaScript) using the **NestJS** toolbox.

Next: the setup files that get our project ready →
[02-project-and-config-files.md](02-project-and-config-files.md)
