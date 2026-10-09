import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const config = window.SIDLNE_CONFIG || {};
const root = document.getElementById('root');
const DAY = 864e5;
const COLORS = ['#9a78bf', '#6e9bc8', '#e0864e', '#4fa37a', '#d2668f', '#c9a23a', '#5aa8a8', '#8a8f3c'];
const SPORTS = ['Baseball', 'Basketball', 'Cheer', 'Dance', 'Football', 'Gymnastics', 'Hockey', 'Lacrosse', 'Soccer', 'Softball', 'Swimming', 'Tennis', 'Track', 'Volleyball', 'Wrestling', 'Other'];
const SPORT_ICONS = { Baseball: '⚾', Basketball: '🏀', Football: '🏈', Hockey: '🏒', Lacrosse: '🥍', Soccer: '⚽', Softball: '🥎', Swimming: '🏊', Tennis: '🎾', Volleyball: '🏐', Gymnastics: '🤸', Track: '🏃', Wrestling: '🤼', Cheer: '📣', Dance: '💃' };
const HOUSEHOLD_KEY = 'sidlne-household';

const supabase = config.supabaseUrl && config.supabaseAnonKey
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null;

const state = {
  session: null,
  profile: null,
  memberships: [],
  household: null,
  role: 'member',
  members: [],
  athletes: [],
  teams: [],
  events: [],
  rides: [],
  messages: [],
  tab: 'Overview',
  view: 'week',
  filter: 'all',
  selected: key(new Date()),
  monthCursor: firstOfMonth(new Date()),
  authMode: 'signin',
  recovering: false,
  channel: null,
};

const icons = {
  Overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  Calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  Teams: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M16 4c3 0 5 2 5 5s-2 5-5 5"/></svg>',
  Rides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14l-1.5-6h-11zM7 11l2-5h6l2 5"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  Chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
  Family: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
};
const NAV = Object.keys(icons);
const TITLES = {
  Overview: ['All your sports. Zero chaos.', 'Everything coming up for your crew.'],
  Calendar: ['The whole game plan.', 'Switch between week and month views.'],
  Teams: ['One crew. Many teams.', 'Athletes, teams and their calendar links.'],
  Rides: ['Who’s got the ride?', 'Claim a drive so everyone knows it’s covered.'],
  Chat: ['Keep the crew in the loop.', 'Messages are shared with everyone in your family.'],
  Family: ['Your family, your rules.', 'Invite people, manage members and your account.'],
};

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function key(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dateFromKey(k) { return new Date(`${k}T12:00:00`); }
function firstOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1, 12); }
function fmtTime(s) { return new Date(s).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
function fmtDate(d) { return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
function fmtLong(d) { return new Date(d).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }); }
function timeInput(d) { return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function esc(s) { return String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function initials(name) { return esc((name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase()); }
function byId(list, id) { return list.find((x) => x.id === id); }
function athleteOf(e) { return byId(state.athletes, e.athlete_id) || byId(state.athletes, byId(state.teams, e.team_id)?.athlete_id); }
function colorOf(e) { return athleteOf(e)?.color || '#b8c0b0'; }
function memberName(id) {
  if (!id) return 'Someone';
  if (id === state.session?.user.id) return 'You';
  const m = state.members.find((x) => x.profile_id === id);
  return m?.profiles?.display_name || m?.profiles?.email || 'Family member';
}
function friendlyError(err) {
  const msg = err?.message || String(err);
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'Can’t reach the server. Check your connection and try again.';
  return msg;
}

function toast(s) {
  const t = document.getElementById('toast');
  t.textContent = s;
  t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2600);
}

function showModal(html) {
  document.getElementById('modal').innerHTML = `<button class="close" data-action="close-modal" aria-label="Close">×</button>${html}`;
  document.getElementById('modalBg').classList.remove('hidden');
  document.querySelector('#modal input:not([type=hidden]), #modal select, #modal textarea')?.focus();
}
function closeModal() { document.getElementById('modalBg').classList.add('hidden'); }

async function busy(form, fn) {
  const btn = form?.querySelector('button[type=submit], button:not([type])');
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = 'Working…'; }
  form?.querySelector('.error')?.remove();
  try {
    await fn();
  } catch (err) {
    console.error(err);
    const box = `<div class="error">${esc(friendlyError(err))}</div>`;
    if (form) form.insertAdjacentHTML('afterbegin', box); else toast(friendlyError(err));
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; }
  }
}

function must({ data, error }) { if (error) throw error; return data; }

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function loadMemberships() {
  const uid = state.session.user.id;
  state.profile = must(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
  state.memberships = must(await supabase.from('household_members').select('role, household_id, households(id, name, invite_code)').eq('profile_id', uid));
}

async function selectHousehold(id) {
  const m = state.memberships.find((x) => x.household_id === id) || state.memberships[0];
  if (!m) { state.household = null; return; }
  state.household = m.households;
  state.role = m.role;
  try { localStorage.setItem(HOUSEHOLD_KEY, m.household_id); } catch {}
  await loadHouseholdData();
  subscribe();
}

async function loadHouseholdData() {
  const hid = state.household.id;
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const [members, athletes, teams, events, rides, messages] = await Promise.all([
    supabase.from('household_members').select('id, role, profile_id, profiles(id, display_name, email)').eq('household_id', hid),
    supabase.from('athletes').select('*').eq('household_id', hid).order('created_at'),
    supabase.from('teams').select('*').eq('household_id', hid).order('inserted_at'),
    supabase.from('events').select('*').eq('household_id', hid).gte('start', since).order('start').limit(5000),
    supabase.from('rides').select('*, events!inner(household_id)').eq('events.household_id', hid),
    supabase.from('messages').select('*').eq('household_id', hid).order('inserted_at', { ascending: false }).limit(200),
  ]);
  state.members = must(members);
  state.athletes = must(athletes);
  state.teams = must(teams);
  state.events = must(events);
  state.rides = must(rides);
  state.messages = must(messages).reverse();
}

async function reload(...tables) {
  if (!state.household) return;
  const hid = state.household.id;
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const jobs = {
    events: async () => { state.events = must(await supabase.from('events').select('*').eq('household_id', hid).gte('start', since).order('start').limit(5000)); },
    rides: async () => { state.rides = must(await supabase.from('rides').select('*, events!inner(household_id)').eq('events.household_id', hid)); },
    teams: async () => { state.teams = must(await supabase.from('teams').select('*').eq('household_id', hid).order('inserted_at')); },
    athletes: async () => { state.athletes = must(await supabase.from('athletes').select('*').eq('household_id', hid).order('created_at')); },
    members: async () => { state.members = must(await supabase.from('household_members').select('id, role, profile_id, profiles(id, display_name, email)').eq('household_id', hid)); },
    messages: async () => { state.messages = must(await supabase.from('messages').select('*').eq('household_id', hid).order('inserted_at', { ascending: false }).limit(200)).reverse(); },
  };
  await Promise.all(tables.map((t) => jobs[t]()));
}

function subscribe() {
  if (state.channel) supabase.removeChannel(state.channel);
  const hid = state.household.id;
  let pending = new Set();
  let timer;
  const queue = (table) => {
    pending.add(table);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const tables = [...pending];
      pending = new Set();
      try { await reload(...tables); } catch (err) { console.error(err); return; }
      // Don't rebuild the chat view (and wipe a half-typed message) on background updates
      if (state.tab === 'Chat') renderMessages();
      else renderMain();
    }, 250);
  };
  state.channel = supabase.channel(`household-${hid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `household_id=eq.${hid}` }, () => queue('events'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `household_id=eq.${hid}` }, () => queue('messages'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => queue('rides'))
    .subscribe();
}

// ---------------------------------------------------------------------------
// Boot & auth
// ---------------------------------------------------------------------------
async function boot() {
  if (!supabase) return renderSetupNeeded();
  const params = new URLSearchParams(location.search);
  const join = params.get('join');
  if (join) { try { sessionStorage.setItem('sidlne-join', join.toUpperCase()); } catch {} }

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY') { state.recovering = true; state.session = session; renderAuth(); return; }
    if (event === 'SIGNED_OUT') { state.session = null; state.household = null; renderAuth(); return; }
    if (event === 'TOKEN_REFRESHED') state.session = session;
  });

  const { data } = await supabase.auth.getSession();
  state.session = data.session;
  if (location.hash.includes('type=recovery')) state.recovering = true;
  if (!state.session || state.recovering) return renderAuth();
  await enter();
}

async function enter() {
  root.innerHTML = '<div class="boot">Loading your schedule…</div>';
  try {
    await loadMemberships();
    let pendingJoin = null;
    try { pendingJoin = sessionStorage.getItem('sidlne-join'); } catch {}
    if (pendingJoin) {
      try { sessionStorage.removeItem('sidlne-join'); } catch {}
      history.replaceState(null, '', location.pathname);
      try {
        const h = must(await supabase.rpc('join_household', { code: pendingJoin }));
        await loadMemberships();
        localStorage.setItem(HOUSEHOLD_KEY, h.id);
        toast(`You joined ${h.name}`);
      } catch (err) { toast(friendlyError(err)); }
    }
    if (!state.memberships.length) return renderOnboarding();
    let saved = null;
    try { saved = localStorage.getItem(HOUSEHOLD_KEY); } catch {}
    await selectHousehold(saved);
    renderApp();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="boot"><div style="text-align:center;max-width:420px;padding:20px"><h2>Something went wrong</h2><p>${esc(friendlyError(err))}</p><button class="primary" data-action="retry">Try again</button> <button class="outline" data-action="sign-out">Sign out</button></div></div>`;
  }
}

function renderSetupNeeded() {
  root.innerHTML = `<div class="boot"><div class="auth-card"><span class="eyebrow">SETUP REQUIRED</span><h2>Connect a Supabase project</h2><p>Set <code>supabaseUrl</code> and <code>supabaseAnonKey</code> in <code>config.js</code>, or add the <code>SUPABASE_URL</code> and <code>SUPABASE_ANON_KEY</code> repository variables and redeploy. See the README for the full checklist.</p></div></div>`;
}

function authHero() {
  return `<div class="auth-hero"><div class="brand">SIDLNE<b>/</b></div><div><h1>Every sport.<br>One place.</h1><p>The shared family calendar for practices, games, tournaments and who’s driving.</p><ul><li>Pull in team calendars from TeamSnap, SportsEngine, LeagueApps and more</li><li>See every kid’s schedule in one week view</li><li>Claim rides and chat with the whole family</li></ul></div><span class="ghost">S/</span><small style="color:#7d8678;position:relative;z-index:1">© ${new Date().getFullYear()} SIDLNE</small></div>`;
}

function renderAuth() {
  const mode = state.recovering ? 'reset' : state.authMode;
  let joining = null;
  try { joining = sessionStorage.getItem('sidlne-join'); } catch {}
  const forms = {
    signin: `<span class="eyebrow">WELCOME BACK</span><h2>Sign in</h2>${joining ? '<p>Sign in to join your family’s calendar.</p>' : '<p>Pick up right where your crew left off.</p>'}
      <form class="form" data-form="signin"><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="current-password" required minlength="8"></label><button class="primary full" type="submit">Sign in</button></form>
      <div class="auth-links"><button data-action="auth-mode" data-mode="signup">Create an account</button><button data-action="auth-mode" data-mode="forgot">Forgot password?</button></div>`,
    signup: `<span class="eyebrow">GET STARTED</span><h2>Create your account</h2><p>Free for families. Takes under a minute.</p>
      <form class="form" data-form="signup"><label>Your name<input name="name" autocomplete="name" required maxlength="60"></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"><small class="hint">At least 8 characters.</small></label><button class="primary full" type="submit">Create account</button></form>
      <div class="auth-links"><button data-action="auth-mode" data-mode="signin">I already have an account</button></div>`,
    forgot: `<span class="eyebrow">RESET PASSWORD</span><h2>Forgot your password?</h2><p>We’ll email you a link to set a new one.</p>
      <form class="form" data-form="forgot"><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="primary full" type="submit">Send reset link</button></form>
      <div class="auth-links"><button data-action="auth-mode" data-mode="signin">Back to sign in</button></div>`,
    reset: `<span class="eyebrow">RESET PASSWORD</span><h2>Choose a new password</h2>
      <form class="form" data-form="reset"><label>New password<input name="password" type="password" autocomplete="new-password" required minlength="8"></label><button class="primary full" type="submit">Save password</button></form>`,
  };
  root.innerHTML = `<div class="auth-wrap">${authHero()}<div class="auth-card">${forms[mode]}<div class="auth-foot"><a href="privacy.html">Privacy</a> · <a href="support.html">Support</a> · <a href="install.html">Install on your phone</a></div></div></div>`;
}

function renderOnboarding() {
  let code = '';
  try { code = sessionStorage.getItem('sidlne-join') || ''; } catch {}
  const name = state.profile?.display_name?.split(' ')[0];
  root.innerHTML = `<div class="auth-wrap">${authHero()}<div class="auth-card" style="width:min(560px,100% - 32px)"><span class="eyebrow">WELCOME${name ? ', ' + esc(name.toUpperCase()) : ''}</span><h2>Set up your family</h2><p>Create a family calendar, or join one someone already shared with you.</p>
    <div class="choice"><div class="panel"><h3>Start a family</h3><p>You’ll get an invite code to share.</p><form class="form" data-form="create-household"><label>Family name<input name="name" required maxlength="80" placeholder="The Rivera Family"></label><button class="primary full" type="submit">Create</button></form></div>
    <div class="panel"><h3>Join a family</h3><p>Enter the code they sent you.</p><form class="form" data-form="join-household"><label>Invite code<input name="code" required maxlength="20" value="${esc(code)}" placeholder="A1B2C3D4E5" style="text-transform:uppercase"></label><button class="primary full" type="submit">Join</button></form></div></div>
    <div class="auth-links"><button data-action="sign-out">Sign out</button></div></div></div>`;
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
function renderApp() {
  const me = state.profile?.display_name || state.session.user.email;
  root.innerHTML = `<div class="app">
    <aside class="sidebar">
      <div class="brand">SIDLNE<b>/</b></div>
      <button class="workspace" data-action="go" data-tab="Family"><i>${initials(state.household.name)}</i><div><strong>${esc(state.household.name)}</strong><small>${state.members.length} ${state.members.length === 1 ? 'member' : 'members'} · ${state.athletes.length} ${state.athletes.length === 1 ? 'athlete' : 'athletes'}</small></div></button>
      <div class="nav-title">MENU</div>
      <nav class="nav" id="sideNav"></nav>
      <div class="privacy"><strong>${esc(me)}</strong>${esc(state.session.user.email)}<br><button class="signout" data-action="sign-out" style="padding:0;margin-top:8px">Sign out</button></div>
    </aside>
    <div class="shell">
      <header class="topbar"><div class="crumb">${esc(state.household.name)} <b>/</b> <span id="crumb"></span></div><div class="top-actions"><span class="live" id="live"><i></i>Synced</span><button class="avatar" data-action="go" data-tab="Family" aria-label="Family settings">${initials(me)}</button></div></header>
      <main class="content">
        <div class="page-head"><div><div class="eyebrow">${esc(new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase())}</div><h1 id="pageTitle"></h1><div class="subtitle" id="pageSubtitle"></div></div><button class="primary" data-action="add-event">＋ Add event</button></div>
        <div id="main"></div>
        <footer><span>SIDLNE / EVERY SPORT. ONE PLACE.</span><span class="footer-links"><a href="install.html">INSTALL</a><a href="privacy.html">PRIVACY</a><a href="support.html">SUPPORT</a></span></footer>
      </main>
    </div>
  </div>
  <nav class="mobile-nav" id="mobileNav"></nav>
  ${installTip()}`;
  renderMain();
}

function installTip() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem('sidlne-install-dismissed') === '1'; } catch {}
  if (!ios || standalone || dismissed) return '';
  return '<div class="install" id="installTip"><div><b>Add SIDLNE to your Home Screen</b><p>Tap Share, then “Add to Home Screen.”</p></div><button class="x" data-action="dismiss-install" aria-label="Dismiss">×</button></div>';
}

function renderMain() {
  if (!document.getElementById('main')) return;
  const tab = state.tab;
  document.getElementById('crumb').textContent = tab;
  document.getElementById('pageTitle').textContent = TITLES[tab][0];
  document.getElementById('pageSubtitle').textContent = TITLES[tab][1];
  const navHTML = NAV.map((n) => `<button class="${tab === n ? 'active' : ''}" data-action="go" data-tab="${n}">${icons[n]}<span>${n}</span></button>`).join('');
  document.getElementById('sideNav').innerHTML = navHTML;
  document.getElementById('mobileNav').innerHTML = navHTML;
  const views = { Overview: overviewHTML, Calendar: calendarPageHTML, Teams: teamsHTML, Rides: ridesHTML, Chat: chatHTML, Family: familyHTML };
  document.getElementById('main').innerHTML = views[tab]();
  if (tab === 'Chat') scrollChat();
}

function go(tab) {
  state.tab = tab;
  renderMain();
  window.scrollTo({ top: 0 });
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------
function filtered() {
  return state.events.filter((e) => state.filter === 'all' || athleteOf(e)?.id === state.filter);
}
function eventsFor(k) { return filtered().filter((e) => key(new Date(e.start)) === k); }
function upcoming(days) {
  const now = Date.now();
  return filtered().filter((e) => new Date(e.end || e.start).getTime() > now && (!days || new Date(e.start).getTime() < now + days * DAY));
}
function rideFor(eventId) { return state.rides.find((r) => r.event_id === eventId && r.status !== 'cancelled'); }

function conflicts(list) {
  const out = [];
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const aEnd = new Date(a.end || +new Date(a.start) + 3600e3), bStart = new Date(b.start);
      if (bStart >= aEnd) break;
      if (athleteOf(a)?.id !== athleteOf(b)?.id) out.push([a, b]);
    }
  }
  return out;
}

function overviewHTML() {
  const next = upcoming()[0];
  const week = upcoming(7);
  const teamCount = state.teams.length;
  const nextRide = next && rideFor(next.id);
  const setupDone = state.athletes.length && state.teams.length && state.events.length && state.members.length > 1;
  const clash = conflicts(week)[0];
  const synced = state.teams.filter((t) => t.calendar_url).length;

  const hero = `<div class="grid-top"><div class="next"><span class="eyebrow">UP NEXT</span>${next
    ? `<h2>${esc(next.title)}</h2><p>◷ ${esc(fmtDate(next.start))} · ${esc(fmtTime(next.start))}${athleteOf(next) ? ' · ' + esc(athleteOf(next).name) : ''}</p>${next.location ? `<p>⌖ ${esc(next.location)}</p>` : ''}<span class="pill ride-chip ${nextRide?.driver_profile_id ? 'ok' : 'warn'}">${nextRide?.driver_profile_id ? `🚗 ${esc(memberName(nextRide.driver_profile_id))} driving` : 'NEEDS A DRIVER'}</span>`
    : '<h2>Your next play starts here.</h2><p>Add an event or connect a team calendar to fill your lineup.</p>'}<span class="ghost">S/</span></div>
    <div class="stat"><span class="eyebrow">NEXT 7 DAYS</span><strong>${week.length}</strong><p>${week.length === 1 ? 'event' : 'events'}<br>in the lineup</p><small>${state.athletes.length} ${state.athletes.length === 1 ? 'athlete' : 'athletes'} · ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}</small></div></div>`;

  const rail = setupDone
    ? `<div class="rail-card"><h2>Heads up</h2>${clash
      ? `<span class="chip">SCHEDULE OVERLAP</span><h3>Two places.<br>One you.</h3><p>${esc(athleteOf(clash[0])?.name || clash[0].title)} and ${esc(athleteOf(clash[1])?.name || clash[1].title)} overlap on ${esc(fmtDate(clash[0].start))}. Line up a driver.</p><button class="outline" data-action="go" data-tab="Rides">Plan the rides</button>`
      : `<span class="chip" style="background:#e4f2d2;color:#3f6a1c">ALL CLEAR</span><h3>No overlaps<br>this week.</h3><p>Nobody needs to be in two places at once.</p>`}</div>
      <div class="rail-card"><h2>Team calendars</h2><p>${synced ? `${synced} of ${teamCount} ${teamCount === 1 ? 'team syncs' : 'teams sync'} automatically from their league app.` : 'Paste a team’s calendar link from TeamSnap, SportsEngine, LeagueApps and more to import its schedule.'}</p><button class="link-btn" data-action="go" data-tab="Teams">Manage teams →</button></div>`
    : `<div class="rail-card"><h2>Get set up</h2><ul class="checklist">
      ${checkItem(state.athletes.length, 'Add your athletes', 'add-athlete')}
      ${checkItem(state.teams.length, 'Add a team', 'add-team')}
      ${checkItem(state.events.length, 'Add or import events', state.teams.length ? 'go-teams' : 'add-event')}
      ${checkItem(state.members.length > 1, 'Invite your co-parent or family', 'invite')}</ul></div>`;

  return `${hero}<div class="main-grid"><div class="panel">${calendarPanelHTML()}</div><aside class="rail">${rail}</aside></div>`;
}

function checkItem(done, label, action) {
  return `<li class="${done ? 'done' : ''}"><i>${done ? '✓' : ''}</i><span>${label}</span>${done ? '' : `<button class="link-btn" style="margin-left:auto" data-action="${action}">Start →</button>`}</li>`;
}

function calendarPageHTML() { return `<div class="panel">${calendarPanelHTML()}</div>`; }

function calendarPanelHTML() {
  const list = eventsFor(state.selected);
  const filters = [{ id: 'all', name: 'Everyone' }, ...state.athletes];
  return `<div class="panel-head"><h2>Your lineup</h2><div class="head-actions"><div class="segmented"><button data-action="view" data-view="week" class="${state.view === 'week' ? 'active' : ''}">Week</button><button data-action="view" data-view="month" class="${state.view === 'month' ? 'active' : ''}">Month</button></div><button class="link-btn" data-action="today">Today</button></div></div>
    <div class="calendar-tools"><div class="filters">${filters.map((a) => `<button class="${state.filter === a.id ? 'active' : ''}" data-action="filter" data-id="${a.id}">${a.color ? `<i class="dot" style="background:${esc(a.color)}"></i>` : ''}${esc(a.name)}</button>`).join('')}</div>
    <div class="period"><button data-action="period" data-dir="-1" aria-label="Previous">‹</button><strong>${esc(periodLabel())}</strong><button data-action="period" data-dir="1" aria-label="Next">›</button></div></div>
    ${state.view === 'week' ? weekHTML() : monthHTML()}
    <div class="day-title">${esc(fmtLong(dateFromKey(state.selected)))}<span>${list.length} ${list.length === 1 ? 'event' : 'events'}</span></div>
    <div>${list.length ? list.map(eventHTML).join('') : `<div class="empty"><h3>Nothing scheduled.</h3><p>Enjoy the day off, or <button class="text-btn" data-action="add-event" data-date="${state.selected}">add an event</button>.</p></div>`}</div>`;
}

function weekStart() {
  const d = dateFromKey(state.selected);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function periodLabel() {
  if (state.view === 'month') return state.monthCursor.toLocaleDateString([], { month: 'long', year: 'numeric' });
  const s = weekStart(), e = new Date(s);
  e.setDate(e.getDate() + 6);
  const f = (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return `${f(s)} – ${f(e)}`;
}

function dotsHTML(list, max) {
  return `<span class="dots">${list.slice(0, max).map((e) => `<i class="dot" style="background:${esc(colorOf(e))}"></i>`).join('')}</span>`;
}

function weekHTML() {
  const s = weekStart();
  const today = key(new Date());
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(s); d.setDate(d.getDate() + i); return d; });
  return `<div class="week">${days.map((d) => {
    const k = key(d);
    return `<button data-action="day" data-day="${k}" class="${state.selected === k ? 'active' : ''}"${k === today ? ' aria-current="date"' : ''}><span>${esc(d.toLocaleDateString([], { weekday: 'short' }))}</span><strong>${d.getDate()}</strong>${dotsHTML(eventsFor(k), 4)}</button>`;
  }).join('')}</div>`;
}

function monthHTML() {
  const first = state.monthCursor;
  const grid = new Date(first);
  grid.setDate(1 - first.getDay());
  const today = key(new Date());
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(grid); d.setDate(d.getDate() + i); return d; });
  const labels = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 7 + i).toLocaleDateString([], { weekday: 'short' }));
  return `<div class="month-labels">${labels.map((x) => `<span>${esc(x)}</span>`).join('')}</div><div class="month">${days.map((d) => {
    const k = key(d), es = eventsFor(k);
    return `<button data-action="day" data-day="${k}" class="month-day ${d.getMonth() !== first.getMonth() ? 'outside' : ''} ${state.selected === k ? 'active' : ''} ${k === today ? 'today' : ''}"><b>${d.getDate()}</b>${dotsHTML(es, 4)}${es.slice(0, 3).map((e) => `<span class="mini-event" style="--c:${esc(colorOf(e))}">${esc(fmtTime(e.start))} · ${esc(e.title)}</span>`).join('')}${es.length > 3 ? `<span class="more">+${es.length - 3} more</span>` : ''}</button>`;
  }).join('')}</div>`;
}

function eventHTML(e) {
  const t = fmtTime(e.start).split(' ');
  const a = athleteOf(e), team = byId(state.teams, e.team_id);
  const ride = rideFor(e.id);
  return `<button class="event" data-action="open-event" data-id="${e.id}"><span class="time"><strong>${esc(t[0])}</strong><small>${esc(t[1] || '')}</small></span><i class="bar" style="--c:${esc(colorOf(e))}"></i><span>${a || team?.sport ? `<small class="tag" style="--c:${esc(colorOf(e))}">${esc([a?.name, team?.sport].filter(Boolean).join(' · '))}</small>` : ''}<h3>${esc(e.title)}</h3>${team ? `<p>${esc(team.name)}</p>` : ''}${e.location ? `<p>⌖ ${esc(e.location)}</p>` : ''}${ride?.driver_profile_id ? `<p>🚗 ${esc(memberName(ride.driver_profile_id))} driving</p>` : ''}</span><small class="source">${e.source === 'ical' ? 'Team calendar' : ''}</small></button>`;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
function teamsHTML() {
  const athletes = state.athletes.length
    ? state.athletes.map((a) => `<button class="athlete-chip" data-action="edit-athlete" data-id="${a.id}"><i class="dot" style="background:${esc(a.color)}"></i>${esc(a.name)}</button>`).join('')
    : '<p class="subtitle">Add each kid (or adult) whose schedule you track.</p>';
  const teams = state.teams.length
    ? `<div class="teams">${state.teams.map((t) => {
      const a = byId(state.athletes, t.athlete_id);
      return `<div class="team-card"><div class="team-icon">${SPORT_ICONS[t.sport] || '🏅'}</div><h2>${esc(t.name)}</h2><p>${esc([a?.name, t.sport].filter(Boolean).join(' · ') || 'No athlete assigned')}</p>
        <p class="meta">${t.calendar_url ? (t.last_synced_at ? `<span class="sync-ok">● Calendar linked</span> · synced ${esc(fmtDate(t.last_synced_at))} ${esc(fmtTime(t.last_synced_at))}` : '<span class="sync-ok">● Calendar linked</span> · not synced yet') : 'No calendar link · add events by hand'}</p>
        <div class="row-actions">${t.calendar_url ? `<button class="outline" data-action="sync-team" data-id="${t.id}">Sync now</button>` : ''}<button class="outline" data-action="edit-team" data-id="${t.id}">Edit</button>${a ? `<button class="link-btn" data-action="filter-athlete" data-id="${a.id}">View lineup</button>` : ''}</div></div>`;
    }).join('')}</div>`
    : '<div class="panel empty"><h3>No teams yet.</h3><p>Add a team to color-code events and import its schedule.</p></div>';
  return `<div class="section"><div class="section-head"><h2>Athletes</h2><button class="outline" data-action="add-athlete">＋ Add athlete</button></div><div class="athlete-chips">${athletes}</div></div>
    <div class="section"><div class="section-head"><h2>Teams</h2><button class="outline" data-action="add-team">＋ Add team</button></div>${teams}</div>
    <div class="rail-card"><h2>Where do I find a team’s calendar link?</h2><p><strong>TeamSnap:</strong> Schedule → Export → Subscribe, copy the link.<br><strong>SportsEngine:</strong> Team page → Calendar → Subscribe → copy iCal link.<br><strong>LeagueApps / Sports Connect / Crossbar / GameChanger:</strong> look for “Subscribe”, “Sync calendar” or “iCal”.<br>Links starting with <code>webcal://</code> work too.</p></div>`;
}

function athleteForm(a) {
  const color = a?.color || COLORS[state.athletes.length % COLORS.length];
  showModal(`<span class="eyebrow">ATHLETE</span><h2>${a ? 'Edit athlete' : 'Add an athlete'}</h2>
    <form class="form" data-form="athlete" data-id="${a?.id || ''}"><label>Name<input name="name" required maxlength="60" value="${esc(a?.name)}"></label>
    <label>Color<select name="color">${COLORS.map((c, i) => `<option value="${c}" ${c === color ? 'selected' : ''}>${['Violet', 'Blue', 'Orange', 'Green', 'Pink', 'Gold', 'Teal', 'Olive'][i]}</option>`).join('')}</select></label>
    <button class="primary full" type="submit">${a ? 'Save' : 'Add athlete'}</button></form>
    ${a ? `<div class="row-actions"><button class="danger-btn" data-action="delete-athlete" data-id="${a.id}">Remove ${esc(a.name)}</button></div>` : ''}`);
}

function teamForm(t) {
  showModal(`<span class="eyebrow">TEAM</span><h2>${t ? 'Edit team' : 'Add a team'}</h2>
    <form class="form" data-form="team" data-id="${t?.id || ''}"><label>Team name<input name="name" required maxlength="80" value="${esc(t?.name)}" placeholder="Northside U12 Lacrosse"></label>
    <div class="form-grid"><label>Athlete<select name="athlete_id"><option value="">—</option>${state.athletes.map((a) => `<option value="${a.id}" ${t?.athlete_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label>Sport<select name="sport"><option value="">—</option>${SPORTS.map((s) => `<option ${t?.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
    <label>Calendar link (optional)<input name="calendar_url" type="text" inputmode="url" value="${esc(t?.calendar_url)}" placeholder="webcal://… or https://….ics"><small class="hint">We’ll import the schedule and keep it up to date whenever you sync.</small></label>
    <button class="primary full" type="submit">${t ? 'Save team' : 'Add team'}</button></form>
    ${t ? `<div class="row-actions"><button class="danger-btn" data-action="delete-team" data-id="${t.id}">Delete team and its imported events</button></div>` : ''}`);
}

async function syncTeam(id, quiet) {
  const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { team_id: id } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  await reload('events', 'teams');
  if (!quiet) toast(`Imported ${data.imported} ${data.imported === 1 ? 'event' : 'events'}`);
  renderMain();
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------
function eventForm(e, dateKey) {
  const start = e ? new Date(e.start) : (() => { const d = dateKey ? dateFromKey(dateKey) : new Date(); d.setHours(17, 0, 0, 0); return d; })();
  const end = e?.end ? new Date(e.end) : new Date(+start + 3600e3);
  showModal(`<span class="eyebrow">${e ? 'EDIT EVENT' : 'NEW EVENT'}</span><h2>${e ? esc(e.title) : 'Add an event'}</h2>${e?.source === 'ical' ? '<p>This event comes from a team calendar. Changes may be replaced the next time it syncs.</p>' : ''}
    <form class="form" data-form="event" data-id="${e?.id || ''}"><label>Event name<input name="title" required maxlength="200" value="${esc(e?.title)}" placeholder="Practice, game, tournament…"></label>
    <div class="form-grid"><label>Athlete<select name="athlete_id"><option value="">Everyone</option>${state.athletes.map((a) => `<option value="${a.id}" ${athleteOf(e || {})?.id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label>Team<select name="team_id"><option value="">—</option>${state.teams.map((t) => `<option value="${t.id}" ${e?.team_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label></div>
    <div class="form-grid three"><label>Date<input name="date" type="date" required value="${key(start)}"></label><label>Starts<input name="start" type="time" required value="${timeInput(start)}"></label><label>Ends<input name="end" type="time" value="${timeInput(end)}"></label></div>
    <label>Location<input name="location" maxlength="200" value="${esc(e?.location)}" placeholder="Field, gym or address"></label>
    <label>Notes<textarea name="description" maxlength="2000">${esc(e?.description)}</textarea></label>
    <button class="primary full" type="submit">${e ? 'Save changes' : 'Add event'}</button></form>`);
}

function openEvent(id) {
  const e = byId(state.events, id);
  if (!e) return;
  const a = athleteOf(e), team = byId(state.teams, e.team_id), ride = rideFor(e.id);
  const me = state.session.user.id;
  const rideLine = ride?.driver_profile_id
    ? `🚗 ${esc(memberName(ride.driver_profile_id))} ${ride.driver_profile_id === me ? 'are' : 'is'} driving${ride.notes ? ` · ${esc(ride.notes)}` : ''}`
    : '🚗 No driver yet';
  showModal(`<span class="eyebrow">${esc([a?.name, team?.sport].filter(Boolean).join(' · ') || 'EVENT')}</span><h2>${esc(e.title)}</h2>${team ? `<p>${esc(team.name)}</p>` : ''}
    <div class="info"><div>◷ ${esc(fmtLong(e.start))} · ${esc(fmtTime(e.start))}${e.end ? '–' + esc(fmtTime(e.end)) : ''}</div>${e.location ? `<div>⌖ <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.location)}" target="_blank" rel="noopener">${esc(e.location)}</a></div>` : ''}<div>${rideLine}</div>${e.source === 'ical' ? '<div>↻ Imported from team calendar</div>' : ''}</div>
    ${e.description ? `<p style="white-space:pre-wrap">${esc(e.description)}</p>` : ''}
    <div class="row-actions">${ride?.driver_profile_id === me ? `<button class="outline" data-action="release-ride" data-id="${e.id}">I can’t drive</button>` : `<button class="primary" data-action="claim-ride" data-id="${e.id}">${ride?.driver_profile_id ? 'I’ll drive instead' : 'I’ll drive'}</button>`}
    <button class="outline" data-action="edit-event" data-id="${e.id}">Edit</button><button class="danger-btn" data-action="delete-event" data-id="${e.id}">Delete</button></div>`);
}

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------
function ridesHTML() {
  const list = upcoming(14);
  const me = state.session.user.id;
  if (!list.length) return '<div class="panel empty"><h3>No events in the next two weeks.</h3><p>When events are on the calendar, you can claim drives here.</p></div>';
  const open = list.filter((e) => !rideFor(e.id)?.driver_profile_id).length;
  return `<div class="list-card"><div class="panel-head" style="padding:16px 0 4px"><h2>Next 14 days</h2><span class="pill ${open ? 'warn' : 'ok'}">${open ? `${open} NEED${open === 1 ? 'S' : ''} A DRIVER` : 'ALL COVERED'}</span></div>
    ${list.map((e) => {
      const ride = rideFor(e.id), a = athleteOf(e);
      const driver = ride?.driver_profile_id;
      return `<div class="list-row"><span class="avatar" style="background:${esc(colorOf(e))};color:#fff">${initials(a?.name || e.title)}</span><span class="grow"><strong>${esc(e.title)}</strong><span class="sub">${esc(fmtDate(e.start))} · ${esc(fmtTime(e.start))}${e.location ? ' · ' + esc(e.location) : ''}</span></span>
        ${driver ? `<span class="pill ok">${esc(memberName(driver).toUpperCase())}${driver === me ? '' : ' DRIVING'}</span>` : '<span class="pill warn">NEEDS DRIVER</span>'}
        ${driver === me ? `<button class="outline" data-action="release-ride" data-id="${e.id}">Release</button>` : `<button class="outline" data-action="claim-ride" data-id="${e.id}">I’ll drive</button>`}</div>`;
    }).join('')}</div>`;
}

async function claimRide(eventId, claim) {
  const ride = state.rides.find((r) => r.event_id === eventId);
  const me = state.session.user.id;
  const values = claim ? { driver_profile_id: me, status: 'assigned' } : { driver_profile_id: null, status: 'open' };
  if (ride) must(await supabase.from('rides').update(values).eq('id', ride.id));
  else if (claim) must(await supabase.from('rides').insert({ event_id: eventId, ...values }));
  await reload('rides');
  toast(claim ? 'You’re driving. Thanks!' : 'Ride released');
  renderMain();
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function chatHTML() {
  return `<div class="chat" style="grid-template-columns:1fr"><div class="messages"><h2>${esc(state.household.name)}</h2><div class="message-list" id="messageList">${messagesHTML()}</div>
    <form class="compose" data-form="message"><input name="body" placeholder="Message your family…" aria-label="Message" maxlength="2000" autocomplete="off" required><button class="primary" type="submit">Send</button></form></div></div>`;
}

function messagesHTML() {
  const me = state.session.user.id;
  if (!state.messages.length) return '<div class="empty"><h3>No messages yet.</h3><p>Say hi to get the conversation started.</p></div>';
  return state.messages.map((m) => {
    const name = memberName(m.sender_id);
    const when = new Date(m.inserted_at);
    const stamp = key(when) === key(new Date()) ? fmtTime(when) : `${fmtDate(when)} · ${fmtTime(when)}`;
    return `<div class="message ${m.sender_id === me ? 'mine' : ''}"><span class="avatar">${initials(name)}</span><div class="bubble"><small>${esc(name)} · ${esc(stamp)}</small>${esc(m.body)}</div></div>`;
  }).join('');
}

function renderMessages() {
  const list = document.getElementById('messageList');
  if (!list) return;
  list.innerHTML = messagesHTML();
  scrollChat();
}

function scrollChat() {
  const list = document.getElementById('messageList');
  if (list) list.scrollTop = list.scrollHeight;
  if (window.innerWidth <= 700) window.scrollTo({ top: document.body.scrollHeight });
}

// ---------------------------------------------------------------------------
// Family settings
// ---------------------------------------------------------------------------
function inviteLink() {
  return `${location.origin}${location.pathname}?join=${encodeURIComponent(state.household.invite_code)}`;
}

function familyHTML() {
  const admin = ['owner', 'admin'].includes(state.role);
  const me = state.session.user.id;
  const others = state.memberships.filter((m) => m.household_id !== state.household.id);
  return `<div class="main-grid"><div>
    <div class="section"><div class="section-head"><h2>Invite your family</h2></div><div class="list-card" style="padding:20px 22px"><p class="subtitle" style="margin-top:0">Share this code or link with a co-parent, grandparent or carpool partner. Anyone with it can join <strong>${esc(state.household.name)}</strong>.</p>
      <span class="code">${esc(state.household.invite_code)}</span>
      <div class="row-actions"><button class="primary" data-action="share-invite">Share invite link</button><button class="outline" data-action="copy-invite">Copy link</button>${admin ? '<button class="outline" data-action="rotate-code">Reset code</button>' : ''}</div></div></div>
    <div class="section"><div class="section-head"><h2>Members</h2></div><div class="list-card">${state.members.map((m) => `<div class="list-row"><span class="avatar">${initials(m.profiles?.display_name || m.profiles?.email)}</span><span class="grow"><strong>${esc(m.profiles?.display_name || 'Family member')}${m.profile_id === me ? ' (you)' : ''}</strong><span class="sub">${esc(m.profiles?.email || '')}</span></span><span class="pill">${esc(m.role.toUpperCase())}</span>${admin && m.profile_id !== me && m.role !== 'owner' ? `<button class="danger-btn" data-action="remove-member" data-id="${m.id}">Remove</button>` : ''}</div>`).join('')}</div></div>
  </div><aside class="rail">
    <div class="rail-card"><h2>Your profile</h2><form class="form" data-form="profile"><label>Display name<input name="display_name" required maxlength="60" value="${esc(state.profile?.display_name)}"></label><button class="outline" type="submit">Save</button></form>
      <p style="margin-top:14px">${esc(state.session.user.email)}</p><div class="row-actions"><button class="outline" data-action="change-password">Change password</button><button class="outline" data-action="sign-out">Sign out</button></div></div>
    <div class="rail-card"><h2>Family</h2>${admin ? `<form class="form" data-form="household"><label>Family name<input name="name" required maxlength="80" value="${esc(state.household.name)}"></label><button class="outline" type="submit">Rename</button></form>` : `<p>${esc(state.household.name)}</p>`}
      ${others.length ? `<p style="margin-top:14px">Switch to:</p>${others.map((m) => `<button class="outline" style="margin:0 6px 6px 0" data-action="switch-household" data-id="${m.household_id}">${esc(m.households.name)}</button>`).join('')}` : ''}
      <div class="row-actions"><button class="link-btn" data-action="new-household">＋ Create or join another family</button></div>
      <div class="row-actions">${state.role === 'owner' ? '<button class="danger-btn" data-action="delete-household">Delete family</button>' : '<button class="danger-btn" data-action="leave-household">Leave family</button>'}</div></div>
    <div class="rail-card"><h2>Account</h2><p>Permanently delete your account and personal data. Families you own are deleted too.</p><button class="danger-btn" data-action="delete-account">Delete my account</button></div>
  </aside></div>`;
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { prompt('Copy this link:', text); }
}

// ---------------------------------------------------------------------------
// Event handling
// ---------------------------------------------------------------------------
const actions = {
  'close-modal': closeModal,
  retry: () => enter(),
  'auth-mode': (el) => { state.authMode = el.dataset.mode; renderAuth(); },
  'sign-out': async () => { if (state.channel) supabase.removeChannel(state.channel); await supabase.auth.signOut(); state.session = null; renderAuth(); },
  'dismiss-install': () => { document.getElementById('installTip')?.remove(); try { localStorage.setItem('sidlne-install-dismissed', '1'); } catch {} },
  go: (el) => { closeModal(); go(el.dataset.tab); },
  'go-teams': () => go('Teams'),
  view: (el) => { state.view = el.dataset.view; state.monthCursor = firstOfMonth(dateFromKey(state.selected)); renderMain(); },
  today: () => { state.selected = key(new Date()); state.monthCursor = firstOfMonth(new Date()); renderMain(); },
  filter: (el) => { state.filter = el.dataset.id; renderMain(); },
  'filter-athlete': (el) => { state.filter = el.dataset.id; go('Calendar'); },
  day: (el) => { state.selected = el.dataset.day; renderMain(); },
  period: (el) => {
    const dir = +el.dataset.dir;
    if (state.view === 'week') { const d = dateFromKey(state.selected); d.setDate(d.getDate() + 7 * dir); state.selected = key(d); }
    else { const m = state.monthCursor; state.monthCursor = new Date(m.getFullYear(), m.getMonth() + dir, 1, 12); state.selected = key(state.monthCursor); }
    renderMain();
  },
  'add-event': (el) => eventForm(null, el.dataset.date),
  'open-event': (el) => openEvent(el.dataset.id),
  'edit-event': (el) => eventForm(byId(state.events, el.dataset.id)),
  'delete-event': async (el) => {
    if (!confirm('Delete this event for everyone in your family?')) return;
    await busy(null, async () => { must(await supabase.from('events').delete().eq('id', el.dataset.id)); await reload('events', 'rides'); closeModal(); renderMain(); toast('Event deleted'); });
  },
  'claim-ride': (el) => busy(null, async () => { await claimRide(el.dataset.id, true); if (!document.getElementById('modalBg').classList.contains('hidden')) openEvent(el.dataset.id); }),
  'release-ride': (el) => busy(null, async () => { await claimRide(el.dataset.id, false); if (!document.getElementById('modalBg').classList.contains('hidden')) openEvent(el.dataset.id); }),
  'add-athlete': () => athleteForm(),
  'edit-athlete': (el) => athleteForm(byId(state.athletes, el.dataset.id)),
  'delete-athlete': async (el) => {
    if (!confirm('Remove this athlete? Their events stay on the calendar.')) return;
    await busy(null, async () => { must(await supabase.from('athletes').delete().eq('id', el.dataset.id)); if (state.filter === el.dataset.id) state.filter = 'all'; await reload('athletes', 'teams', 'events'); closeModal(); renderApp(); });
  },
  'add-team': () => teamForm(),
  'edit-team': (el) => teamForm(byId(state.teams, el.dataset.id)),
  'delete-team': async (el) => {
    if (!confirm('Delete this team? Events imported from its calendar are deleted too.')) return;
    await busy(null, async () => { must(await supabase.from('teams').delete().eq('id', el.dataset.id)); await reload('teams', 'events', 'rides'); closeModal(); renderMain(); toast('Team deleted'); });
  },
  'sync-team': async (el) => { el.disabled = true; el.textContent = 'Syncing…'; await busy(null, () => syncTeam(el.dataset.id)); if (el.isConnected) { el.disabled = false; el.textContent = 'Sync now'; } },
  invite: () => go('Family'),
  'share-invite': async () => {
    const url = inviteLink();
    if (navigator.share) { try { await navigator.share({ title: 'Join our family on SIDLNE', text: `Join ${state.household.name} on SIDLNE. Invite code: ${state.household.invite_code}`, url }); } catch {} }
    else copyText(url);
  },
  'copy-invite': () => copyText(inviteLink()),
  'rotate-code': async () => {
    if (!confirm('Reset the invite code? The old code and link will stop working.')) return;
    await busy(null, async () => { state.household.invite_code = must(await supabase.rpc('rotate_invite_code', { hid: state.household.id })); renderMain(); toast('New invite code ready'); });
  },
  'remove-member': async (el) => {
    if (!confirm('Remove this person from your family?')) return;
    await busy(null, async () => { must(await supabase.from('household_members').delete().eq('id', el.dataset.id)); await reload('members'); renderApp(); });
  },
  'switch-household': (el) => busy(null, async () => { state.filter = 'all'; await selectHousehold(el.dataset.id); state.tab = 'Overview'; renderApp(); }),
  'new-household': () => { if (state.channel) supabase.removeChannel(state.channel); renderOnboarding(); root.querySelector('.auth-links').insertAdjacentHTML('afterbegin', '<button data-action="retry">← Back to my family</button>'); },
  'leave-household': async () => {
    if (!confirm(`Leave ${state.household.name}? You’ll need a new invite to rejoin.`)) return;
    await busy(null, async () => { must(await supabase.from('household_members').delete().eq('household_id', state.household.id).eq('profile_id', state.session.user.id)); try { localStorage.removeItem(HOUSEHOLD_KEY); } catch {} await enter(); });
  },
  'delete-household': async () => {
    if (prompt(`This permanently deletes ${state.household.name}, its events, teams and messages for everyone. Type DELETE to confirm.`) !== 'DELETE') return;
    await busy(null, async () => { must(await supabase.from('households').delete().eq('id', state.household.id)); try { localStorage.removeItem(HOUSEHOLD_KEY); } catch {} await enter(); });
  },
  'change-password': () => showModal('<span class="eyebrow">ACCOUNT</span><h2>Change password</h2><form class="form" data-form="reset"><label>New password<input name="password" type="password" autocomplete="new-password" required minlength="8"></label><button class="primary full" type="submit">Save password</button></form>'),
  'delete-account': async () => {
    if (prompt('This permanently deletes your account. Families you own are deleted for everyone. Type DELETE to confirm.') !== 'DELETE') return;
    await busy(null, async () => { must(await supabase.rpc('delete_my_account')); await supabase.auth.signOut(); state.session = null; renderAuth(); toast('Your account was deleted'); });
  },
};

const forms = {
  signin: async (f) => {
    must(await supabase.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') }));
    state.session = (await supabase.auth.getSession()).data.session;
    await enter();
  },
  signup: async (f, form) => {
    const res = must(await supabase.auth.signUp({ email: f.get('email').trim(), password: f.get('password'), options: { data: { display_name: f.get('name').trim() }, emailRedirectTo: location.origin + location.pathname } }));
    if (res.session) { state.session = res.session; await enter(); }
    else form.outerHTML = '<div class="success"><strong>Check your email.</strong> Tap the confirmation link we sent, then come back and sign in.</div>';
  },
  forgot: async (f, form) => {
    must(await supabase.auth.resetPasswordForEmail(f.get('email').trim(), { redirectTo: location.origin + location.pathname }));
    form.outerHTML = '<div class="success">If an account exists for that email, a reset link is on its way.</div>';
  },
  reset: async (f) => {
    must(await supabase.auth.updateUser({ password: f.get('password') }));
    closeModal();
    toast('Password updated');
    if (state.recovering) { state.recovering = false; history.replaceState(null, '', location.pathname); await enter(); }
  },
  'create-household': async (f) => {
    const h = must(await supabase.rpc('create_household', { household_name: f.get('name').trim() }));
    try { localStorage.setItem(HOUSEHOLD_KEY, h.id); } catch {}
    state.tab = 'Overview';
    await enter();
  },
  'join-household': async (f) => {
    const h = must(await supabase.rpc('join_household', { code: f.get('code').trim() }));
    try { localStorage.setItem(HOUSEHOLD_KEY, h.id); sessionStorage.removeItem('sidlne-join'); } catch {}
    state.tab = 'Overview';
    await enter();
    toast(`Welcome to ${h.name}`);
  },
  athlete: async (f, form) => {
    const values = { name: f.get('name').trim(), color: f.get('color') };
    const id = form.dataset.id;
    if (id) must(await supabase.from('athletes').update(values).eq('id', id));
    else must(await supabase.from('athletes').insert({ ...values, household_id: state.household.id }));
    await reload('athletes');
    closeModal();
    renderApp();
  },
  team: async (f, form) => {
    const athlete = byId(state.athletes, f.get('athlete_id'));
    const values = {
      name: f.get('name').trim(),
      sport: f.get('sport') || null,
      athlete_id: athlete?.id || null,
      athlete_name: athlete?.name || null,
      calendar_url: f.get('calendar_url').trim() || null,
    };
    const id = form.dataset.id;
    const existing = id && byId(state.teams, id);
    const team = id
      ? must(await supabase.from('teams').update(values).eq('id', id).select().single())
      : must(await supabase.from('teams').insert({ ...values, household_id: state.household.id }).select().single());
    if (values.athlete_id !== (existing?.athlete_id ?? null) && existing) {
      must(await supabase.from('events').update({ athlete_id: values.athlete_id }).eq('team_id', team.id));
    }
    await reload('teams', 'events');
    closeModal();
    renderMain();
    if (team.calendar_url && team.calendar_url !== existing?.calendar_url) {
      toast('Importing team calendar…');
      try { await syncTeam(team.id); } catch (err) { toast(`Calendar import failed: ${friendlyError(err)}`); }
    }
  },
  event: async (f, form) => {
    const date = f.get('date');
    const start = new Date(`${date}T${f.get('start')}`);
    let end = f.get('end') ? new Date(`${date}T${f.get('end')}`) : null;
    if (end && end < start) end = new Date(+end + DAY); // ends after midnight
    const team = byId(state.teams, f.get('team_id'));
    const values = {
      title: f.get('title').trim(),
      athlete_id: f.get('athlete_id') || team?.athlete_id || null,
      team_id: team?.id || null,
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      location: f.get('location').trim() || null,
      description: f.get('description').trim() || null,
    };
    const id = form.dataset.id;
    if (id) must(await supabase.from('events').update(values).eq('id', id));
    else must(await supabase.from('events').insert({ ...values, household_id: state.household.id, created_by: state.session.user.id, source: 'manual' }));
    await reload('events');
    state.selected = key(start);
    state.monthCursor = firstOfMonth(start);
    closeModal();
    if (!['Overview', 'Calendar'].includes(state.tab)) state.tab = 'Calendar';
    renderMain();
    toast(id ? 'Event updated' : 'Event added');
  },
  message: async (f, form) => {
    const body = f.get('body').trim();
    if (!body) return;
    form.reset();
    must(await supabase.from('messages').insert({ household_id: state.household.id, sender_id: state.session.user.id, body }));
    await reload('messages');
    renderMessages();
    form.querySelector('input').focus();
  },
  profile: async (f) => {
    state.profile = must(await supabase.from('profiles').update({ display_name: f.get('display_name').trim() }).eq('id', state.session.user.id).select().single());
    await reload('members');
    renderApp();
    toast('Profile saved');
  },
  household: async (f) => {
    const h = must(await supabase.from('households').update({ name: f.get('name').trim() }).eq('id', state.household.id).select().single());
    state.household = { ...state.household, ...h };
    const m = state.memberships.find((x) => x.household_id === h.id);
    if (m) m.households = state.household;
    renderApp();
    toast('Family renamed');
  },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-action]');
  if (!el) {
    if (ev.target.id === 'modalBg') closeModal();
    return;
  }
  const fn = actions[el.dataset.action];
  if (fn) { ev.preventDefault(); fn(el); }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target.closest('form[data-form]');
  if (!form) return;
  ev.preventDefault();
  const fn = forms[form.dataset.form];
  if (fn) busy(form, () => fn(new FormData(form), form));
});

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') closeModal(); });

window.addEventListener('online', () => { document.getElementById('live')?.classList.remove('hidden'); if (state.household) reload('events', 'rides', 'messages').then(renderMain).catch(() => {}); });
window.addEventListener('offline', () => { toast('You’re offline. Changes will fail until you reconnect.'); });

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));

boot();
