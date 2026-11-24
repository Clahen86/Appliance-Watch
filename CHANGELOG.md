# Changelog – Appliance Watch

Newest first. Each version lists what changed since the one before.

## 0.9.0 – 2026-11-24

- No more warning in Home Assistant's log at start-up (the version was read from disk in the event loop)
- Store and update links open right inside Home Assistant
- Error reports: a translated message shown on purpose (a refusal) is not reported as an error
- Support: version from Home Assistant's loader, no blocking read in the event loop
- Time without a power reading (a restart, Wi-Fi gone) no longer counts as a rest, so a cycle isn't called done early
- A machine still running when its reading comes back after half an hour goes on as the same cycle, and a lost reading gives no "done" push
- Prices and the cheapest start are worked out once per quarter hour (or when the price changes), not on every power reading – much less CPU
- Opening the door in a pause mid-programme no longer ends the cycle; near the end (or later in the rest) it still does, and a door opened at the end with nothing after it counts as emptied
- Freezer and fridge: learns its own running level and its longest normal runs and rests – no false "runs without a break" from inverter compressors, and no alarm right after a long Home Assistant restart
- Dehumidifier: learns how it rests at its target humidity, so "tank full" only comes when the quiet is unlike that
- One long pause by hand no longer makes every later run wait up to 30 minutes before "done"
- Bare price lists land on the right hours on the days summer time starts and ends
- Past its usual length a running machine shows "any minute" instead of a "1 min" that never ends
- Machine names: "blender" is no 3D printer, "plug four" no oven
- Learning from the history stops when the machine is removed
- Phone pushes keep to the quiet hours: "done", "not emptied", "started" and "still running" wait for the morning (only the latest per machine, nothing if it was emptied meanwhile); alarms still go at once
- "Still running" and "works again" are only sent after the push they correct, and replace it
- At most one "not emptied" reminder per cycle, none once the door was opened, and no "done" push when the door ends the cycle

## 0.8.0 – 2026-11-14

- How it is set up, once a day for the developer (names cleaned), and the Share my setup switch

## 0.7.0 – 2026-11-14

- Update card (new version, your error fixed) and the version in the daily question

## 0.6.2 – 2026-11-14

- No suggestions for dead plugs or the old plug of a machine already set up
- Outdated suggestions are taken back

## 0.6.1 – 2026-11-14

- Files under a new address for every version, so a browser never mixes old and new files

## 0.6.0 – 2026-11-14

- Manifest: recorder in after_dependencies (hassfest)
- Re-run checks
- Suggestions of the other apps (fits your home, from the same developer)

## 0.5.1 – 2026-11-14

- Fix blank panel (missing import), alert card style, new README pictures

## 0.5.0 – 2026-11-14

- Washer-dryer, 3D printer, airfryer/oven, coffee machine
- Freezer and dehumidifier watched (stopped, nonstop, tank full)
- The same price reading as Energy Pilot with grid tariff, taxes, peak and VAT
- Saved by timing

## 0.4.0 – 2026-11-14

- 7 languages, Help (answers from the developer, errors sent anonymously), the usual programme for Energy Pilot

## 0.3.1 – 2026-11-14

- No phone notification of its own when House Chat writes it in the family chat

## 0.3.0 – 2026-11-07

- Front page: the machine in the banner, month's numbers counting up, timeline for today, live curve on the card, glow over the glass
- Learn from history at every start (only new washes)
- Deleted washes do not come back
- History is learned only once for a new machine
- Derefter er den brugerens

## 0.2.0 – 2026-11-06

- Add a machine that is also found: the user's choice takes over
- Quiet programs (cold rinse at 9-15 W) are also recognized
- Start from button press
- Quiet program only above 7 W for 3 min - a lit display (2-4 W) is not a start
- Panel and card do not flicker: only numbers and text are updated, the page is redrawn only when a machine changes state
- Program suggestions per machine, own programs, choose program while it runs
- Menus stay open on update
- If the machine continues shortly after 'It is done', it is the same wash
- Panel: colorful front page with heading, ring with minutes left, running card with glowing edge, menus as sheets that slide up
- Learn from history, speakers (done, soon done, not emptied, emptied, move to tumble dryer, started - each on/off, quiet at night, only when someone is home, try), new card

## 0.1.0 – 2026-11-06

- Appliance Watch 0.1.0: done when the machine is done, programs, price, wear, notification, Assist, panel and card with animated machines
