# Anti-cheat safety boundary

Sekai Dota Helper is an independent desktop note and timer window. It must remain technically isolated from Dota 2 and Steam.

## Allowed

- Render user-authored, static strategy notes and item images.
- Run a clock started or calibrated by an explicit user action.
- Use ordinary top-level window properties such as transparency and always-on-top.
- Register one ordinary operating-system global shortcut for toggling this app's own mouse pass-through state.
- Download public metadata or images before a match, without using match/account state.

## Permanently forbidden

- Opening the Dota or Steam process, reading/writing/scanning its memory, or discovering offsets.
- DLL injection, code injection, hooks inside the game, graphics API interception, or replacing game files.
- Reading hidden game state, console output, network packets, local IPC, logs, replays, screenshots, pixels, or audio to infer live match state.
- Simulating keyboard or mouse input, macros, auto-casting, auto-buying, or controlling the Dota UI.
- Detecting heroes, items, cooldowns, wards, enemies, draft state, or match time automatically.
- Bypassing, probing, disabling, or attempting to evade VAC or any other anti-cheat mechanism.
- Shipping an update that weakens these restrictions without an explicit security review.

Run the source-level tripwire before release:

```bash
npm run security:vac-boundary
```

Passing this check is evidence that obvious prohibited APIs are absent from first-party source; it is not a guarantee or a Valve approval. Dependencies and release binaries must also be reviewed and signed. Valve can change its policy or detection at any time.
