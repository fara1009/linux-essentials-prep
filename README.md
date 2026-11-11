# Linux Essentials — Exam Preparation

**[Open the public study website](https://linux-essentials-13-18-prep.eleganthobby.chatgpt.site/)** — mobile friendly and available without signing in.

Complete English study notes for NDG Linux Essentials lessons 13–18: 198 sections with theory, commands, descriptions, examples, and sample output.

- One numbered page for each lesson.
- 180 quiz questions with shuffled topics and answers, explanations, practice and exam modes.
- 350 self-check flashcards.
- Full-text search, command examples, and a separate review list for mistakes.
- Progress is saved locally in each visitor’s browser.
- Responsive layout, printable lessons, and downloadable complete notes.

## Lessons

13. Where Data Is Stored: processes, memory, logs, and the file-system hierarchy.
14. Network Configuration: IP, routing, DNS, and SSH.
15. System and User Security.
16. Creating Users and Groups.
17. Ownership and Permissions.
18. Special Directories and Files: special permission bits, inodes, and links.

## Run locally

Node.js is required. No external dependencies are needed.

```sh
node build.mjs
node verify.mjs
node server.mjs
```

Open http://localhost:4173/. Stop the server with Ctrl+C.

## Source files

- `content/lessons.json`: complete English lesson notes.
- `content/questions.txt`: quiz questions, choices, and explanations.
- `build.mjs`: generates pages, flashcards, and search indexes in `dist/`.
- `app.mjs`: interface, search, quizzes, and local progress.
- `engine.mjs`: shuffling, balanced sampling, and grading.
- `verify.mjs`: validates complete notes, examples, questions, links, and quiz logic.

To use static hosting, upload the contents of `dist/` to the domain root. The site uses root-relative paths.

Command examples are educational and are not executed by the website. Reference links are retained in the lesson notes.
