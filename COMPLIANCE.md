# Blockwise: compliance and audit notes (9 Nov 2026)

This is a practical engineering checklist, **not legal advice**. Have a qualified lawyer review the policies for the countries your visitors are in (for example the GDPR in the EU/UK and India's DPDP Act) before relying on them.

## What was done

| Request | Status |
|---|---|
| Privacy policy, Terms, Cookie policy | `privacy.html`, `terms.html`, `cookies.html` (served at `/privacy`, `/terms`, `/cookies`), linked in the site footer |
| Cookie + form consent | No cookies are set. A privacy notice banner explains local storage. The leaderboard form has a required consent tick box. A "Privacy settings" panel shows what is stored and can delete it. |
| Collect only required data | No accounts, emails or analytics. Leaderboard stores nickname, score and a hashed random device code only. IP is used only for a 60-second rate-limit counter. Certificate name and share images stay in the browser. |
| Right to erasure | "Remove my score" (leaderboard) and "Delete all data on this device" |
| Audit 3rd-party SDKs | See table below. No SDKs, no trackers. A strict Content-Security-Policy (`vercel.json`) blocks any third-party script, font, image or request from loading. |
| No hidden charges | Terms state the site is free. The simulator fee is labelled "simulated". |
| No fake reviews | The site contains no reviews, testimonials or ratings. |
| No unsupported claims | Copy audited. Changed: "safe to learn" to "beginner-friendly", "Bitcoin explained properly" to "in plain English", softened two myth statements and named the source for one. Certificate is labelled "not an accredited qualification". Hypothetical tools carry disclaimers. |
| Colour contrast | Automated WCAG AA audit (text vs background, every page, dark and light themes, modals): 0 failures. Light-mode accent, green and red colours were darkened to pass. |
| Licence stock images | The site uses no stock images. Logo and icons are original. Inter typeface is under the SIL Open Font License (`OFL.txt`, credited in the Terms). |

## Third-party audit

**In the visitor's browser:** none. No analytics, ads, social pixels, chat widgets, CDNs, or external fonts. Fonts are embedded. The only outbound things are plain links (Instagram, CoinGecko / alternative.me attribution, news headlines).

**Server-side only (visitors never contact these directly):**

| Service | Used for | Data sent | Notes |
|---|---|---|---|
| Vercel | Hosting | Standard web request data | Hosting provider |
| Upstash Redis | Leaderboard | Nickname, score, hashed device code, 60s rate-limit counters | Choose an EU region if most visitors are in the EU |
| CoinGecko | Prices and charts | None about users | Attribution shown in footer. Check their API terms for your usage. |
| CryptoCompare | Price fallback and price history | None about users | Check their terms for your usage |
| mempool.space, Blockstream | Block height | None about users | |
| alternative.me | Fear and Greed index | None about users | Attribution shown in footer |
| CoinDesk, Cointelegraph, Bitcoin Magazine, Decrypt | Headlines via public RSS | None about users | Only headline + link + source shown. **Check each publisher's terms for RSS reuse and remove any feed that does not allow it** (edit the list at the top of `api/news.js`). |

## Please review / decide

1. **Contact details.** The policies list your Instagram DM as the contact. A dedicated email address is better practice. Add it to all three pages.
2. **Governing law.** Now set to the laws of India (courts in India). A lawyer may want a named city for jurisdiction.
3. **Age.** Set to 18+, or a parent/guardian's permission, because India's DPDP Act treats anyone under 18 as a child. The leaderboard consent tick says this too.
4. **Data location** and provider data-processing terms (Vercel, Upstash): check them and mention any region choice in the privacy policy.
5. **If you ever add analytics, ads, or any tracking**, update the privacy and cookie policies and add a real opt-in choice before switching it on. Vercel Web Analytics also counts as a change.
6. **Share and certificate text** says "not an accredited qualification". Keep it.
7. Re-run the checks when you change copy: look for words like "guaranteed", "safe", "best", "risk-free".

## India notes (added 9 Nov 2026)

- **DPDP Act 2023 and Rules 2025:** the Rules were notified in November 2025; the main duties (notice, consent, erasure, breach reporting, children's data) apply from about 13 May 2027. Blockwise already follows them voluntarily: plain-language notice, tick-box consent, easy withdrawal, erasure, a grievance route, and no tracking of children.
- **Crypto risk disclaimer (ASCI):** India's ad regulator requires the line "Crypto products and NFTs are unregulated and can be highly risky. There may be no regulatory recourse for any loss from such transactions." on advertisements for or featuring crypto, including every picture or video in social posts. It is in the site footer, the Terms and the story video. Put it on any other crypto promo you post (Instagram posts, reels, story images).
- **Tax:** Blockwise gives no tax advice and states that Indian crypto tax rules are specific and change.
- **Not legal advice:** please have an Indian lawyer review the policies before you rely on them, ideally before May 2027.
