# Kulostřel

Logická střílečka kuliček v enginu [BLIT386](https://blit386.dev). Hraje se v prohlížeči i v terminálu.

Zamiř odpalovačem a vystřel kuličku do shluku, který visí ze stropu. Tři a více kuliček stejné barvy prasknou; kuličky,
které tím ztratí spojení se stropem, spadnou. Po několika výstřelech sjede strop o řadu níž. Vyčisti plochu a kolo je
tvoje; když kulička překročí čáru nad odpalovačem, hra končí.

## Ovládání

| Akce | Klávesnice | Myš |
| --- | --- | --- |
| Mířit | šipky vlevo/vpravo nebo A/D (ťuknutí = malý krok, podržení = plynulé otáčení) | pohyb myší |
| Vystřelit | mezerník, šipka nahoru nebo W | levé tlačítko |
| Prohodit aktuální a další kuličku | šipka dolů nebo S | pravé tlačítko |

## Spuštění

Potřebuješ [Bun](https://bun.sh) 1.3+.

```bash
bun install
bun run dev    # v prohlížeči (adresu vypíše terminál)
bun run term   # v terminálu přes blit-term (Luquas95/Blit386_ASCI)
bun test       # testy herní logiky
```

## Struktura

- `src/game.js` - herní smyčka: vstup, stavy hry, vykreslování.
- `src/board.js` - mřížka kuliček (šestiúhelníkové rozložení, praskání skupin, padání kuliček).
- `src/shot.js` - let kuličky, odrazy od stěn, pomocná čára míření.
- `src/levels.js` - úrovně jako textové mapy.
- `src/config.js` - rozměry a laditelné hodnoty.

## Helpful commands

- `bun run dev` - start the game (the everyday command).
- `npx blit run` - the same thing, the friendly way.
- `npx blit play` - play-test the game from the terminal and print its state (`npx blit play --help` for the steps).
- `npx blit doctor` - check your setup if something seems off.
- `npx blit upgrade` - update BLIT386 to the latest version.
- `npx blit agents add <name>` - set up an AI assistant you did not pick at the start (`claude`, `cursor`,
  `antigravity`, `codex`, `copilot`, `gemini`, `opencode`, or `zed`); `npx blit agents sync` keeps its files current.
- `npx blit clean` - replace `src/game.js` with an empty skeleton when you want to start your own game from scratch.

The `blit` helper is installed inside this project, not on your whole computer, so it needs `npx` in front (it means
"run the helper that lives in this project"). Typing plain `blit` would say "command not found."

Everything here works the same on Windows (PowerShell or Command Prompt), macOS, and Linux. The `.gitattributes` file
keeps line endings consistent on every computer, so `format:check` agrees everywhere.

## Peek behind the scenes

While the game runs, you can open the engine overlay - a small panel showing frames per second and which renderer is
active.

- Keyboard: press the key just below Esc, in the very top-left corner of your keyboard. On US keyboards it is printed
  with `` ` `` and `~`. Classic PC games like Quake used that exact key to open their command console, and BLIT386 keeps
  the tradition. The engine listens for the key's position, not the symbol printed on it - on some keyboard layouts the
  `~` symbol sits somewhere else entirely, but the overlay key is still the one below Esc.
- No keyboard, or can't find the key? Click or tap the bottom-left corner of the game screen instead. That works
  everywhere: phones, tablets, the Steam Deck.

## Share your game

When you want to show your game to a friend:

```bash
bun run build
```

This packs everything into a `dist/` folder - a plain website, no server needed. Drag that folder onto a free static
host such as [Netlify Drop](https://app.netlify.com/drop) or [Cloudflare Pages](https://pages.cloudflare.com), and you
get a link anyone can open.

## When something breaks

It will - that is normal. Open `docs/when-something-breaks.md`. It explains how to read error messages and walks through
the usual suspects: blank screens, "command not found," forgotten `await`, and more.

## Learn more

- `AGENTS.md` - a short home base for you or an AI assistant.
- `docs/` - nine friendly guides: getting started, the game loop, drawing, input, colors, randomness and world
  generation, sound, hot reload, and fixing problems.
- [blit386.dev](https://blit386.dev) - the full BLIT386 documentation site. If you set up an AI assistant (Claude Code,
  Cursor, Antigravity, Codex, GitHub Copilot, Gemini CLI, OpenCode, or Zed), it can search this site directly - that is
  what its generated docs-server config is for (`.mcp.json` for Claude Code and GitHub Copilot, `.cursor/mcp.json` for
  Cursor, and so on). Claude Code's desktop app also reads `.claude/launch.json` here to start the game's preview server
  for you.
- [blit386.dev/llms.txt](https://blit386.dev/llms.txt) - the whole site's contents as one plain text file, handy for
  skimming or pasting into a chat.
