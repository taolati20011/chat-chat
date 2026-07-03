# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: features.spec.js >> @AI mention triggers Gemini reply in the room
- Location: tests\features.spec.js:179:1

# Error details

```
TimeoutError: page.waitForSelector: Timeout 12000ms exceeded.
Call log:
  - waiting for locator('textarea') to be visible

```

# Page snapshot

```yaml
- generic [ref=e4]:
  - complementary [ref=e5]:
    - generic [ref=e6]:
      - generic [ref=e10]: chat-chat
      - button "Sign out" [ref=e11] [cursor=pointer]:
        - img [ref=e12]
    - generic [ref=e14]:
      - img [ref=e15]
      - textbox "Search rooms" [ref=e18]
    - button "🤖 Chat with AI" [ref=e19] [cursor=pointer]:
      - generic [ref=e20]: 🤖
      - generic [ref=e21]: Chat with AI
    - button "+ Create new category" [ref=e22] [cursor=pointer]:
      - generic [ref=e23]: +
      - generic [ref=e24]: Create new category
    - generic [ref=e25]:
      - generic [ref=e26]: Categories
      - generic [ref=e27]: "0"
    - generic [ref=e29]: No rooms match ""
    - generic [ref=e30]:
      - generic [ref=e31]: A
      - generic [ref=e32]:
        - generic [ref=e33]: "@AliceAI"
        - generic [ref=e34]: online
  - main [ref=e36]:
    - generic [ref=e37]:
      - heading "No room selected" [level=2] [ref=e38]
      - paragraph [ref=e39]: Pick a category on the left, or create a new one.
      - button "+ New category" [ref=e40] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | const BASE = 'http://localhost:5173'
  4   | 
  5   | async function loginAs(browser, username) {
  6   |   const context = await browser.newContext()
  7   |   const page = await context.newPage()
  8   |   await page.addInitScript((u) => {
  9   |     localStorage.setItem('chatchat.user', JSON.stringify({ name: u, expiresAt: Date.now() + 86_400_000 }))
  10  |   }, username)
  11  |   await page.goto(`${BASE}/chat`)
> 12  |   await page.waitForSelector('textarea', { timeout: 12_000 })
      |              ^ TimeoutError: page.waitForSelector: Timeout 12000ms exceeded.
  13  |   return { context, page }
  14  | }
  15  | 
  16  | async function sendMsg(page, text) {
  17  |   const ta = page.locator('textarea')
  18  |   await ta.fill(text)
  19  |   await ta.press('Enter')
  20  | }
  21  | 
  22  | // ──────────────────────────────────────────────────────────────────────────────
  23  | // Test 1: Typing indicator
  24  | // ──────────────────────────────────────────────────────────────────────────────
  25  | test('typing indicator appears and disappears', async ({ browser }) => {
  26  |   const alice = await loginAs(browser, 'Alice')
  27  |   const bob   = await loginAs(browser, 'Bob')
  28  | 
  29  |   await alice.page.waitForTimeout(600)
  30  | 
  31  |   // Alice types something
  32  |   await alice.page.locator('textarea').fill('I am typing something…')
  33  | 
  34  |   // Bob should see the indicator
  35  |   await expect(bob.page.getByText(/typing/i)).toBeVisible({ timeout: 4_000 })
  36  | 
  37  |   // Alice clears input — debounce timer fires typing:stop after 2 s
  38  |   await alice.page.locator('textarea').fill('')
  39  |   await expect(bob.page.getByText(/typing/i)).toBeHidden({ timeout: 6_000 })
  40  | 
  41  |   await alice.context.close()
  42  |   await bob.context.close()
  43  | })
  44  | 
  45  | // ──────────────────────────────────────────────────────────────────────────────
  46  | // Test 2: Message reactions
  47  | // ──────────────────────────────────────────────────────────────────────────────
  48  | test('reactions: add and toggle', async ({ browser }) => {
  49  |   const ts    = Date.now()
  50  |   const alice = await loginAs(browser, `AliceRx${ts}`)
  51  |   const bob   = await loginAs(browser, `BobRx${ts}`)
  52  | 
  53  |   await alice.page.waitForTimeout(600)
  54  | 
  55  |   const msgText = `rxn-${ts}`
  56  |   await sendMsg(alice.page, msgText)
  57  | 
  58  |   // Scope to conversation body (main) to avoid sidebar lastMessage preview
  59  |   const aliceMain = alice.page.locator('main')
  60  |   const bobMain   = bob.page.locator('main')
  61  | 
  62  |   await expect(aliceMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })
  63  |   await expect(bobMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })
  64  | 
  65  |   // Bob hovers and picks 👍 reaction
  66  |   await bobMain.getByText(msgText).hover()
  67  |   await bob.page.getByTitle('Add reaction').click()
  68  |   await bob.page.getByRole('button', { name: '👍' }).first().click()
  69  | 
  70  |   // The reaction pill's title lists who reacted — Bob's unique name should appear
  71  |   await expect(aliceMain.locator(`button[title*="BobRx${ts}"]`)).toBeVisible({ timeout: 5_000 })
  72  |   await expect(bobMain.locator(`button[title*="BobRx${ts}"]`)).toBeVisible({ timeout: 5_000 })
  73  | 
  74  |   // Alice clicks 👍 on this specific message's pill (identified by Bob's name in title)
  75  |   await aliceMain.locator(`button[title*="BobRx${ts}"]`).click()
  76  |   // Now Alice's name is also in the reaction title
  77  |   await expect(aliceMain.locator(`button[title*="AliceRx${ts}"]`)).toBeVisible({ timeout: 6_000 })
  78  | 
  79  |   await alice.context.close()
  80  |   await bob.context.close()
  81  | })
  82  | 
  83  | // ──────────────────────────────────────────────────────────────────────────────
  84  | // Test 3: Unread badge
  85  | // ──────────────────────────────────────────────────────────────────────────────
  86  | test('unread badge appears on inactive room and clears on select', async ({ browser }) => {
  87  |   const alice = await loginAs(browser, 'AliceBadge')
  88  |   const bob   = await loginAs(browser, 'BobBadge')
  89  | 
  90  |   await alice.page.waitForTimeout(600)
  91  | 
  92  |   // Alice goes to Gaming; General becomes inactive
  93  |   await alice.page.locator('aside').getByRole('button').filter({ hasText: 'Gaming' }).click()
  94  |   await alice.page.waitForTimeout(400)
  95  | 
  96  |   // Bob sends a message in General
  97  |   await sendMsg(bob.page, `badge-${Date.now()}`)
  98  | 
  99  |   // The General room button in Alice's sidebar should show a numeric badge div
  100 |   const generalBtn = alice.page.locator('aside').getByRole('button').filter({ hasText: 'General' })
  101 |   const badge = generalBtn.locator('div').filter({ hasText: /^\d+$/ })
  102 |   await expect(badge).toBeVisible({ timeout: 5_000 })
  103 | 
  104 |   // Alice clicks General → badge clears
  105 |   await generalBtn.click()
  106 |   await alice.page.waitForTimeout(400)
  107 |   await expect(badge).toBeHidden({ timeout: 3_000 })
  108 | 
  109 |   await alice.context.close()
  110 |   await bob.context.close()
  111 | })
  112 | 
```