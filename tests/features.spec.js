import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

async function loginAs(browser, username) {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.addInitScript((u) => {
    localStorage.setItem('chatchat.user', JSON.stringify({ name: u, expiresAt: Date.now() + 86_400_000 }))
  }, username)
  await page.goto(`${BASE}/chat`)
  await page.waitForSelector('textarea', { timeout: 12_000 })
  return { context, page }
}

async function sendMsg(page, text) {
  const ta = page.locator('textarea')
  await ta.fill(text)
  await ta.press('Enter')
}

// ──────────────────────────────────────────────────────────────────────────────
// Test 1: Typing indicator
// ──────────────────────────────────────────────────────────────────────────────
test('typing indicator appears and disappears', async ({ browser }) => {
  const alice = await loginAs(browser, 'Alice')
  const bob   = await loginAs(browser, 'Bob')

  await alice.page.waitForTimeout(600)

  // Alice types something
  await alice.page.locator('textarea').fill('I am typing something…')

  // Bob should see the indicator
  await expect(bob.page.getByText(/typing/i)).toBeVisible({ timeout: 4_000 })

  // Alice clears input — debounce timer fires typing:stop after 2 s
  await alice.page.locator('textarea').fill('')
  await expect(bob.page.getByText(/typing/i)).toBeHidden({ timeout: 6_000 })

  await alice.context.close()
  await bob.context.close()
})

// ──────────────────────────────────────────────────────────────────────────────
// Test 2: Message reactions
// ──────────────────────────────────────────────────────────────────────────────
test('reactions: add and toggle', async ({ browser }) => {
  const ts    = Date.now()
  const alice = await loginAs(browser, `AliceRx${ts}`)
  const bob   = await loginAs(browser, `BobRx${ts}`)

  await alice.page.waitForTimeout(600)

  const msgText = `rxn-${ts}`
  await sendMsg(alice.page, msgText)

  // Scope to conversation body (main) to avoid sidebar lastMessage preview
  const aliceMain = alice.page.locator('main')
  const bobMain   = bob.page.locator('main')

  await expect(aliceMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })
  await expect(bobMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })

  // Bob hovers and picks 👍 reaction
  await bobMain.getByText(msgText).hover()
  await bob.page.getByTitle('Add reaction').click()
  await bob.page.getByRole('button', { name: '👍' }).first().click()

  // The reaction pill's title lists who reacted — Bob's unique name should appear
  await expect(aliceMain.locator(`button[title*="BobRx${ts}"]`)).toBeVisible({ timeout: 5_000 })
  await expect(bobMain.locator(`button[title*="BobRx${ts}"]`)).toBeVisible({ timeout: 5_000 })

  // Alice clicks 👍 on this specific message's pill (identified by Bob's name in title)
  await aliceMain.locator(`button[title*="BobRx${ts}"]`).click()
  // Now Alice's name is also in the reaction title
  await expect(aliceMain.locator(`button[title*="AliceRx${ts}"]`)).toBeVisible({ timeout: 6_000 })

  await alice.context.close()
  await bob.context.close()
})

// ──────────────────────────────────────────────────────────────────────────────
// Test 3: Unread badge
// ──────────────────────────────────────────────────────────────────────────────
test('unread badge appears on inactive room and clears on select', async ({ browser }) => {
  const alice = await loginAs(browser, 'AliceBadge')
  const bob   = await loginAs(browser, 'BobBadge')

  await alice.page.waitForTimeout(600)

  // Alice goes to Gaming; General becomes inactive
  await alice.page.locator('aside').getByRole('button').filter({ hasText: 'Gaming' }).click()
  await alice.page.waitForTimeout(400)

  // Bob sends a message in General
  await sendMsg(bob.page, `badge-${Date.now()}`)

  // The General room button in Alice's sidebar should show a numeric badge div
  const generalBtn = alice.page.locator('aside').getByRole('button').filter({ hasText: 'General' })
  const badge = generalBtn.locator('div').filter({ hasText: /^\d+$/ })
  await expect(badge).toBeVisible({ timeout: 5_000 })

  // Alice clicks General → badge clears
  await generalBtn.click()
  await alice.page.waitForTimeout(400)
  await expect(badge).toBeHidden({ timeout: 3_000 })

  await alice.context.close()
  await bob.context.close()
})

// ──────────────────────────────────────────────────────────────────────────────
// Test 4: Message deletion
// ──────────────────────────────────────────────────────────────────────────────
test('message deletion shows placeholder for both users', async ({ browser }) => {
  const alice = await loginAs(browser, 'AliceDel')
  const bob   = await loginAs(browser, 'BobDel')

  await alice.page.waitForTimeout(600)

  const msgText = `delete-${Date.now()}`
  await sendMsg(alice.page, msgText)

  const aliceMain = alice.page.locator('main')
  const bobMain   = bob.page.locator('main')

  await expect(aliceMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })
  await expect(bobMain.getByText(msgText)).toBeVisible({ timeout: 5_000 })

  // Alice hovers then deletes her own message
  await aliceMain.getByText(msgText).hover()
  await alice.page.getByTitle('Delete message').click()

  // Original text disappears for Alice (proof of deletion)
  await expect(aliceMain.getByText(msgText)).toBeHidden({ timeout: 5_000 })
  // "Message deleted" placeholder exists (use .first() — prior test runs may have other deleted msgs)
  await expect(aliceMain.getByText('Message deleted').first()).toBeVisible()

  // Bob also sees the message gone
  await expect(bobMain.getByText(msgText)).toBeHidden({ timeout: 5_000 })
  await expect(bobMain.getByText('Message deleted').first()).toBeVisible()

  await alice.context.close()
  await bob.context.close()
})

// ──────────────────────────────────────────────────────────────────────────────
// Test 5: Streaming AI responses
// ──────────────────────────────────────────────────────────────────────────────
test('AI chat streams response text progressively', async ({ browser }) => {
  const { context, page } = await loginAs(browser, 'AliceStream')

  await page.getByText('Chat with AI').click()
  await page.waitForTimeout(300)

  const ta = page.locator('textarea')
  await ta.fill('Reply with only the single word: hello')
  await ta.press('Enter')

  // The Gemini username (as @Gemini in bubbleWho) should appear
  await expect(
    page.locator('div').filter({ hasText: /^@Gemini ·/ }).first()
  ).toBeVisible({ timeout: 20_000 })

  // Streaming cursor disappears when done
  await expect(page.locator('.stream-cursor')).toBeHidden({ timeout: 15_000 })

  // The reply text is non-empty
  await expect(page.locator('div').filter({ hasText: /hello/i }).first()).toBeVisible()

  await context.close()
})

// ──────────────────────────────────────────────────────────────────────────────
// Test 6: @AI mention in a regular room
// ──────────────────────────────────────────────────────────────────────────────
test('@AI mention triggers Gemini reply in the room', async ({ browser }) => {
  const alice = await loginAs(browser, 'AliceAI')
  const bob   = await loginAs(browser, 'BobAI')

  await alice.page.waitForTimeout(600)

  const question = `@AI What is 1+1? Answer with one word.`
  await sendMsg(alice.page, question)

  // Both see Alice's message (scoped to main conversation)
  await expect(alice.page.locator('main').getByText(question).first()).toBeVisible({ timeout: 5_000 })
  await expect(bob.page.locator('main').getByText(question).first()).toBeVisible({ timeout: 5_000 })

  // Gemini's reply appears for both (up to 25 s for Gemini latency)
  await expect(
    alice.page.locator('main div').filter({ hasText: /^@🤖 Gemini ·/ }).first()
  ).toBeVisible({ timeout: 25_000 })
  await expect(
    bob.page.locator('main div').filter({ hasText: /^@🤖 Gemini ·/ }).first()
  ).toBeVisible({ timeout: 5_000 })

  await alice.context.close()
  await bob.context.close()
})
