# Getting SIDLNE into the App Store

The iPhone app lives in `ios/`. It's a native Capacitor shell around the same web app that runs at https://sidlne.app, plus iPhone-only features: game reminders (local notifications), the native share sheet for invites, and Waze directions.

GitHub builds it on a Mac in the cloud (`.github/workflows/ios.yml`), so you don't need a Mac.

---

## 1. Apple Developer Program, as SIDLNE, LLC

1. **Get a D-U-N-S number for SIDLNE, LLC.** It's free, from Apple's lookup page: https://developer.apple.com/enroll/duns-lookup/. It takes about 5 business days.
   - The legal name and address must exactly match your LLC filing.
2. **Enroll as an Organization** at https://developer.apple.com/programs/enroll/ ($99 a year).
   - You'll need the D-U-N-S number, a website for the company (https://sidlne.app), and an email address. Apple calls to verify.
   - Approval takes about 1–3 weeks.
3. **Note your Team ID.** Find it under developer.apple.com → Account → Membership. It's 10 characters.

## 2. Create the app in App Store Connect

https://appstoreconnect.apple.com → **Apps** → **＋** → **New App**

| Field | Value |
|---|---|
| Platform | iOS |
| Name | SIDLNE |
| Primary language | English (U.S.) |
| Bundle ID | `com.gmail.sidlne`. It must match the Xcode project exactly. If it isn't listed, register it under developer.apple.com → Identifiers → ＋ → App IDs. |
| SKU | `sidlne-ios` |

## 3. Let GitHub upload builds

1. **Create an API key.** In App Store Connect, go to **Users and Access → Integrations → App Store Connect API → ＋**.
   - Name: `GitHub`
   - Access: **Admin**. Admin is needed so the build can create signing certificates automatically.
2. **Download the key.** Save the `AuthKey_XXXXXXXXXX.p8` file. It can be downloaded only once.
3. **Add four secrets.** Go to github.com/aligreenfield-commits/SIDLNE → **Settings → Secrets and variables → Actions → Secrets** and add:

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | Your Team ID from step 1 |
| `APP_STORE_CONNECT_KEY_ID` | The key's **Key ID** |
| `APP_STORE_CONNECT_ISSUER_ID` | The **Issuer ID** shown above the keys list |
| `APP_STORE_CONNECT_KEY` | The whole contents of the `.p8` file, from `-----BEGIN PRIVATE KEY-----` to `-----END PRIVATE KEY-----` |

4. **Start a build.** Go to **Actions → iOS app → Run workflow** on `main`.
   - The build appears in **TestFlight** about 10–30 minutes later.
   - Every later merge to `main` that changes the app uploads a new build automatically.

### Push notifications (schedule-change alerts)

Apple needs a separate key for sending notifications. The App Store Connect key can't do it.

1. Go to **developer.apple.com → Account → Certificates, IDs & Profiles → Keys → ＋**.
2. Name it `SIDLNE Push` and tick **Apple Push Notifications service (APNs)**.
3. Click **Configure**, choose **Sandbox & Production**, then **Save → Continue → Register**.
4. **Download** the `AuthKey_XXXXXXXXXX.p8` file. It can be downloaded only once. Note the **Key ID**.
5. In GitHub, go to **Settings → Environments → NEW KEYS** and add two secrets:

| Secret | Value |
|---|---|
| `APNS_KEY` | The whole contents of that `.p8` file |
| `APNS_KEY_ID` | That key's **Key ID** |

6. Go to **Actions → Deploy calendar sync → Run workflow**. The run says "Push notifications are on" when it worked.

The app build turns on the Push Notifications capability for `com.gmail.sidlne` automatically.

## 4. Test on your iPhone

Install **TestFlight** from the App Store. In App Store Connect, go to **TestFlight → Internal Testing**, add yourself, and install SIDLNE from the TestFlight app.

## Submit with one click

**Actions → Submit to App Store → Run workflow** does sections 5 and 7 for you, plus pricing (free) and availability (all countries). It:
- creates the reviewer demo account (`appreview@sidlne.app`, a sample "Review Family", and a new password each run)
- fills in the listing from `appstore/listing.json`
- uploads the screenshots in `appstore/screenshots/`
- attaches the newest processed build
- submits for review

The app goes live automatically once Apple approves it.

Two things only you can do, once:
1. **App Privacy** (section 6). Apple has no API for it, so fill it in on appstoreconnect.apple.com.
2. **A review contact.** In GitHub → Settings → Environments → NEW KEYS, add:
   - `APP_REVIEW_CONTACT_NAME` (first and last name)
   - `APP_REVIEW_PHONE` (with country code)
   - optionally `APP_REVIEW_EMAIL` (defaults to support@sidlne.app)

   Apple only uses these to reach you about the review; they aren't shown on the App Store.

To change the listing later, edit `appstore/listing.json` (or the screenshots) and run the workflow again.

## 5. Store listing (copy and paste)

**Subtitle** (30 characters max)
> Every sport. One place.

**Promotional text**
> Practices, games, rides and team chat for every kid, in one shared family calendar.

**Description**
> SIDLNE is the shared calendar for sports families. Every practice, game and tournament for every kid, on every team, in one place, and everyone in the family sees the same plan.
>
> • ONE CALENDAR FOR EVERY KID: Week and month views, color-coded by athlete. Filter to one kid with a tap.
> • TEAM SCHEDULES SYNC AUTOMATICALLY: Paste the calendar link from TeamSnap, SportsEngine, LeagueApps, GameChanger and more, and SIDLNE keeps it up to date, including time changes and cancellations.
> • RIDES, SORTED: See which events still need a driver and claim a ride in one tap.
> • GET DIRECTIONS: Open Waze straight to the field.
> • GAME REMINDERS: Get a heads-up an hour before every practice and game.
> • OVERLAP ALERTS: Know when two kids need to be in two places at once.
> • FAMILY CHAT: Keep co-parents, grandparents and carpool partners in the loop.
>
> Private by design. Only the people you invite can see your family's schedule. There are no ads and no tracking, and you can delete your account at any time in the app.

**Keywords** (100 characters max)
> sports,calendar,family,schedule,carpool,teamsnap,practice,game,kids,youth,soccer,rides,league

| Field | Value |
|---|---|
| Category | Primary **Sports**, secondary **Lifestyle** |
| Support URL | https://sidlne.app/support.html |
| Marketing URL | https://sidlne.app/welcome/ |
| Privacy Policy URL | https://sidlne.app/privacy.html |
| Copyright | 2026 SIDLNE, LLC |
| Age rating | Answer **None** to every content question, which gives **4+**. Under "Unrestricted web access", answer **No**. |
| Price | Free |

**Screenshots:** upload the six 1320×2868 PNGs, made from the real app, for the **6.9" iPhone** size. The app is iPhone-only, so no iPad screenshots are needed.

## 6. App Privacy (the "nutrition label")

Choose **Yes, we collect data**, then select the following. For each one, choose **Linked to the user**, **Not used for tracking**, purpose **App Functionality**:

| Data type | Why |
|---|---|
| Contact Info → **Name** | Display name |
| Contact Info → **Email Address** | Sign-in |
| User Content → **Other User Content** | Events, teams, athlete first names, ride plans |
| User Content → **Customer Support** | Only if users email support |
| User Content → **Emails or Text Messages** | Family chat messages |

Not collected: location, contacts, photos, health, financial info, browsing history, identifiers for advertising, diagnostics.

## 7. Review notes, and a demo account Apple can use

Apple's reviewers must be able to sign in. Before submitting:

1. **Create a review account.** Sign up at https://sidlne.app with a separate email, for example a new `sidlne.review@gmail.com`.
2. **Add sample data.** Create a family called **Review Family**, two athletes, a team and a few events with locations.
3. **Fill in App Review Information** in App Store Connect:
   - Sign-in required: **Yes**. Enter that email and password.
   - Notes:
     > SIDLNE is a shared family sports calendar. The demo account belongs to a sample family with athletes, teams and events. Native features: Family → "Turn on reminders" schedules local notifications 1 hour before events; Family → "Share invite link" opens the iOS share sheet; any event → "Get directions" opens Waze (or waze.com). Accounts can be deleted in-app under Family → Delete my account.

Then click **Add for Review → Submit**. Review usually takes 1–3 days.

---

## Updating the app later

- **Website-only changes** (most changes) go live on sidlne.app right away. The iPhone app picks them up with its next build.
- **Each merge to `main`** that touches the app uploads a new TestFlight build automatically.
- **To release an update,** create a new version in App Store Connect, choose the build and submit.
- **To bump the version shown in the store** (for example 1.0 → 1.1), edit `MARKETING_VERSION` in `ios/App/App.xcodeproj/project.pbxproj`.
