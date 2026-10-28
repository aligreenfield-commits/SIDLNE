import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const config = window.SIDLNE_CONFIG || {};
const root = document.getElementById('root');
const DAY = 864e5;
const COLORS = ['#9a78bf', '#6e9bc8', '#e0864e', '#4fa37a', '#d2668f', '#c9a23a', '#5aa8a8', '#8a8f3c'];
const SPORTS = ['Baseball', 'Basketball', 'Cheer', 'Dance', 'Field Hockey', 'Football', 'Gymnastics', 'Hockey', 'Lacrosse', 'Soccer', 'Softball', 'Swimming', 'Tennis', 'Track', 'Volleyball', 'Wrestling', 'Other'];
const SPORT_ICONS = { Baseball: '⚾', Basketball: '🏀', 'Field Hockey': '🏑', Football: '🏈', Hockey: '🏒', Lacrosse: '🥍', Soccer: '⚽', Softball: '🥎', Swimming: '🏊', Tennis: '🎾', Volleyball: '🏐', Gymnastics: '🤸', Track: '🏃', Wrestling: '🤼', Cheer: '📣', Dance: '💃' };
const HOUSEHOLD_KEY = 'sidlne-household';
// Running inside the iPhone app (Capacitor) rather than a browser
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const Plugins = window.Capacitor?.Plugins || {};
// Links that leave the app (emails, invites) must point at the public site
const PUBLIC_URL = NATIVE ? 'https://sidlne.app/' : location.origin + location.pathname;

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
  blocked: new Set(),
  reported: new Set(),
  attendance: [],
  changes: [],
  carpools: [],
  carpoolMembers: [],
  carpoolRides: [],
  carpoolId: null,
  carpoolEvents: [],
  carpoolChannel: null,
  playlists: [],
  tab: 'Overview',
  view: 'week',
  filter: 'all',
  selected: key(new Date()),
  monthCursor: firstOfMonth(new Date()),
  authMode: 'signin',
  recovering: false,
  channel: null,
  syncing: false,
  syncAttempts: {},
};

const icons = {
  Overview: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  Calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  Teams: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M16 4c3 0 5 2 5 5s-2 5-5 5"/></svg>',
  Apps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  Rides: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 17h14l-1.5-6h-11zM7 11l2-5h6l2 5"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  Chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg>',
  Family: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
};
const NAV = Object.keys(icons);
const TITLES = {
  Overview: ['All your sports. Zero chaos.', 'Everything coming up for your crew.'],
  Calendar: ['The whole game plan.', 'Switch between week and month views.'],
  Teams: ['One crew. Many teams.', 'Athletes, teams and where their schedules come from.'],
  Apps: ['Bring it all together.', 'Every team app, synced into one family calendar.'],
  Rides: ['Who’s got the ride?', 'Claim a drive, or set up a carpool with other families.'],
  Chat: ['Keep the crew in the loop.', 'Messages are shared with everyone in your family. Tap ⋯ on a message to report it or block someone.'],
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
// Waze universal link: opens the Waze app if installed, otherwise waze.com, and starts navigation
function wazeUrl(location) { return `https://waze.com/ul?q=${encodeURIComponent(location)}&navigate=yes`; }
function directionsButton(location, cls = 'outline') {
  return location ? `<a class="${cls} directions" href="${esc(wazeUrl(location))}" target="_blank" rel="noopener" aria-label="Take me there (opens Waze)">🧭 Take me there</a>` : '';
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

// The family's events from `since` on, a page at a time (the API returns at most
// 1000 rows per request), with exact repeats of the same game shown once
async function fetchEvents(hid, since) {
  const all = [];
  for (let page = 0; page < 10; page++) {
    const { data, error } = await supabase.from('events').select('*').eq('household_id', hid).gte('start', since)
      .order('start').order('id').range(page * 1000, page * 1000 + 999);
    if (error) return { data: null, error };
    all.push(...data);
    if (data.length < 1000) break;
  }
  const seen = new Set();
  const data = all.filter((e) => {
    const k = `${e.team_id}|${String(e.title).trim().toLowerCase()}|${e.start}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { data, error: null };
}

async function loadHouseholdData() {
  const hid = state.household.id;
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const [members, athletes, teams, events, rides, messages] = await Promise.all([
    supabase.from('household_members').select('id, role, profile_id, profiles(id, display_name, email)').eq('household_id', hid),
    supabase.from('athletes').select('*').eq('household_id', hid).order('created_at'),
    supabase.from('teams').select('*').eq('household_id', hid).order('inserted_at'),
    fetchEvents(hid, since),
    supabase.from('rides').select('*, events!inner(household_id)').eq('events.household_id', hid),
    supabase.from('messages').select('*').eq('household_id', hid).order('inserted_at', { ascending: false }).limit(200),
  ]);
  state.members = must(members);
  state.athletes = must(athletes);
  state.teams = must(teams);
  state.events = must(events);
  state.rides = must(rides);
  state.messages = must(messages).reverse();
  state.attendance = await fetchAttendance(hid, since);
  state.changes = await fetchChanges(hid);
  await loadChatSafety();
  await loadCarpools();
  state.playlists = await fetchPlaylists(hid);
  scheduleReminders();
}

// Schedule changes found by calendar syncs in the last two weeks. Tolerant of a
// database that doesn't have the table yet, so the app still loads.
async function fetchChanges(hid) {
  const { data, error } = await supabase.from('schedule_changes').select('*').eq('household_id', hid)
    .gte('created_at', new Date(Date.now() - 14 * DAY).toISOString()).order('created_at', { ascending: false }).limit(50);
  if (error) { console.warn('Schedule changes unavailable:', error.message); return []; }
  return data;
}

// "Are you going?" answers for this family's recent and upcoming events.
// Tolerant of a database that doesn't have the table yet, so the app still loads.
async function fetchAttendance(hid, since) {
  const { data, error } = await supabase.from('event_attendance')
    .select('event_id, athlete_id, status, updated_by, events!inner(household_id, start)')
    .eq('events.household_id', hid).gte('events.start', since);
  if (error) { console.warn('Attendance unavailable:', error.message); return []; }
  return data;
}

async function reload(...tables) {
  if (!state.household) return;
  const hid = state.household.id;
  const since = new Date(Date.now() - 120 * DAY).toISOString();
  const jobs = {
    events: async () => { state.events = must(await fetchEvents(hid, since)); },
    rides: async () => { state.rides = must(await supabase.from('rides').select('*, events!inner(household_id)').eq('events.household_id', hid)); },
    teams: async () => { state.teams = must(await supabase.from('teams').select('*').eq('household_id', hid).order('inserted_at')); },
    athletes: async () => { state.athletes = must(await supabase.from('athletes').select('*').eq('household_id', hid).order('created_at')); },
    members: async () => { state.members = must(await supabase.from('household_members').select('id, role, profile_id, profiles(id, display_name, email)').eq('household_id', hid)); },
    messages: async () => { state.messages = must(await supabase.from('messages').select('*').eq('household_id', hid).order('inserted_at', { ascending: false }).limit(200)).reverse(); },
    attendance: async () => { state.attendance = await fetchAttendance(hid, since); },
    changes: async () => { state.changes = await fetchChanges(hid); },
  };
  await Promise.all(tables.map((t) => jobs[t]()));
  if (tables.includes('events')) scheduleReminders();
}

function subscribe() {
  if (state.channel) supabase.removeChannel(state.channel);
  const hid = state.household.id;
  let pending = new Set();
  let fresh = [];
  let timer;
  const queue = (table) => {
    pending.add(table);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const tables = [...pending];
      pending = new Set();
      const arrived = fresh;
      fresh = [];
      try { await reload(...tables); } catch (err) { console.error(err); return; }
      if (arrived.length) toast(`📣 ${describeChange(arrived[0])}${arrived.length > 1 ? ` (+${arrived.length - 1} more)` : ''}`);
      // Don't rebuild the chat view (and wipe a half-typed message) on background updates
      if (state.tab === 'Chat') renderMessages();
      else renderMain();
    }, 250);
  };
  state.channel = supabase.channel(`household-${hid}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `household_id=eq.${hid}` }, () => queue('events'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `household_id=eq.${hid}` }, () => queue('messages'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, () => queue('rides'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_attendance' }, () => queue('attendance'))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'schedule_changes', filter: `household_id=eq.${hid}` }, (p) => { fresh.push(p.new); queue('changes'); })
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
  const carpool = params.get('carpool');
  if (carpool) { try { sessionStorage.setItem(CARPOOL_KEY, carpool.toUpperCase()); } catch {} }
  if (params.has('signup')) state.authMode = 'signup'; // "Get started" links from the landing page

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
    let carpoolCode = null;
    try { carpoolCode = sessionStorage.getItem(CARPOOL_KEY); sessionStorage.removeItem(CARPOOL_KEY); } catch {}
    if (carpoolCode) history.replaceState(null, '', location.pathname);
    if (!state.memberships.length) {
      if (carpoolCode) { try { sessionStorage.setItem(CARPOOL_KEY, carpoolCode); } catch {} }
      return renderOnboarding();
    }
    let saved = null;
    try { saved = localStorage.getItem(HOUSEHOLD_KEY); } catch {}
    await selectHousehold(saved);
    renderApp();
    if (carpoolCode) carpoolJoinForm(carpoolCode);
    setupPush();
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
      <form class="form" data-form="signup"><label>Your name<input name="name" autocomplete="name" required maxlength="60"></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" required minlength="8"><small class="hint">At least 8 characters.</small></label><button class="primary full" type="submit">Create account</button><small class="hint">By creating an account you agree to the <a href="terms.html" target="_blank" rel="noopener">Terms of Use</a>: no objectionable content or abusive behavior.</small></form>
      <div class="auth-links"><button data-action="auth-mode" data-mode="signin">I already have an account</button></div>`,
    forgot: `<span class="eyebrow">RESET PASSWORD</span><h2>Forgot your password?</h2><p>We’ll email you a link to set a new one.</p>
      <form class="form" data-form="forgot"><label>Email<input name="email" type="email" autocomplete="email" required></label><button class="primary full" type="submit">Send reset link</button></form>
      <div class="auth-links"><button data-action="auth-mode" data-mode="signin">Back to sign in</button></div>`,
    reset: `<span class="eyebrow">RESET PASSWORD</span><h2>Choose a new password</h2>
      <form class="form" data-form="reset"><label>New password<input name="password" type="password" autocomplete="new-password" required minlength="8"></label><button class="primary full" type="submit">Save password</button></form>`,
  };
  root.innerHTML = `<div class="auth-wrap">${authHero()}<div class="auth-card">${forms[mode]}<div class="auth-foot"><a href="welcome/">About SIDLNE</a> · <a href="privacy.html">Privacy</a> · <a href="terms.html">Terms</a> · <a href="support.html">Support</a> · <a href="install.html">Install on your phone</a></div></div></div>`;
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
  autoSync();
}

function installTip() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let dismissed = false;
  try { dismissed = localStorage.getItem('sidlne-install-dismissed') === '1'; } catch {}
  if (NATIVE || !ios || standalone || dismissed) return '';
  return '<div class="install" id="installTip"><div><b>Add SIDLNE to your Home Screen</b><p>Tap Share, then “Add to Home Screen.”</p></div><button class="x" data-action="dismiss-install" aria-label="Dismiss">×</button></div>';
}

function renderMain() {
  if (!document.getElementById('main')) return;
  saveSiriSnapshot();
  const tab = state.tab;
  document.getElementById('crumb').textContent = tab;
  document.getElementById('pageTitle').textContent = TITLES[tab][0];
  document.getElementById('pageSubtitle').textContent = TITLES[tab][1];
  const navHTML = NAV.map((n) => `<button class="${tab === n ? 'active' : ''}" data-action="go" data-tab="${n}">${icons[n]}<span>${n}</span></button>`).join('');
  document.getElementById('sideNav').innerHTML = navHTML;
  document.getElementById('mobileNav').innerHTML = navHTML;
  const views = { Overview: overviewHTML, Calendar: calendarPageHTML, Teams: teamsHTML, Apps: appsPageHTML, Rides: ridesHTML, Chat: chatHTML, Family: familyHTML };
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

// Bold black hero card: lime eyebrow, big tight headline
function heroCard({ eyebrow, title, text = '', extra = '', actions = '', ghost = '' }) {
  return `<div class="hero-card">${ghost ? `<span class="ghost">${esc(ghost)}</span>` : ''}<span class="eyebrow">${esc(eyebrow)}</span><h2>${title}</h2>${extra}${text ? `<p>${text}</p>` : ''}${actions ? `<div class="row-actions">${actions}</div>` : ''}</div>`;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function connectedApps() {
  return [...new Set(state.teams.filter((t) => t.calendar_url).map((t) => calendarSource(t.calendar_url) || 'Team calendar'))];
}
function appBadge(n) {
  return `<span class="app-logo" title="${esc(n)}">${esc(APP_ABBR[n] || n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase())}</span>`;
}

// "One place beats five.": the family's connected team apps as badges
function onePlaceCard(synced, teamCount) {
  const apps = connectedApps();
  const badges = apps.length ? apps : ['TeamSnap', 'SportsEngine', 'LeagueApps', 'GameChanger', 'Sports Connect', 'Crossbar'];
  const badge = appBadge;
  const text = synced
    ? `${synced} of ${teamCount} ${teamCount === 1 ? 'team syncs' : 'teams sync'} automatically from ${apps.length === 1 ? esc(apps[0]) : `${apps.length} apps`}.`
    : 'Paste a team’s calendar link from TeamSnap, SportsEngine, LeagueApps and more, and SIDLNE keeps it in sync.';
  return `<div class="rail-card one-place"><h2>One place beats ${apps.length > 1 ? (NUMBER_WORDS[apps.length] || apps.length) : 'five'}.</h2><div class="app-badges">${badges.map(badge).join('')}</div><p>${text}</p><button class="link-btn" data-action="go" data-tab="Apps">${apps.length ? 'See your apps →' : 'Connect a team app →'}</button></div>`;
}

function overviewHTML() {
  const next = upcoming()[0];
  const week = upcoming(7);
  const teamCount = state.teams.length;
  const setupDone = state.athletes.length && state.teams.length && state.events.length && state.members.length > 1;
  const clash = conflicts(week)[0];
  const synced = state.teams.filter((t) => t.calendar_url).length;

  const hero = `<div class="grid-top"><div class="next"><span class="eyebrow">UP NEXT</span>${next
    ? `<h2>${esc(next.title)}</h2><p>◷ ${esc(fmtDate(next.start))} · ${esc(fmtTime(next.start))}${athleteOf(next) ? ' · ' + esc(athleteOf(next).name) : ''}</p>${next.location ? `<p>⌖ ${esc(next.location)}</p>` : ''}<span class="pill ride-chip ${driveStatus(next).ok ? 'ok' : 'warn'}">${esc(driveStatus(next).label)}</span><div class="next-actions">${directionsButton(next.location, 'primary')}${gameDayButton(next.athlete_id, 'outline gameday-hero')}</div>`
    : '<h2>Your next play starts here.</h2><p>Add an event or connect a team calendar to fill your lineup.</p>'}<span class="ghost">S/</span></div>
    <div class="stat"><span class="eyebrow">NEXT 7 DAYS</span><strong>${week.length}</strong><p>${week.length === 1 ? 'event' : 'events'}<br>in the lineup</p><small>${state.athletes.length} ${state.athletes.length === 1 ? 'athlete' : 'athletes'} · ${teamCount} ${teamCount === 1 ? 'team' : 'teams'}</small></div></div>`;

  const rail = setupDone
    ? `<div class="rail-card"><h2>Heads up</h2>${clash
      ? `<span class="chip">SCHEDULE OVERLAP</span><h3>Two places.<br>One you.</h3><p>${esc(athleteOf(clash[0])?.name || clash[0].title)} and ${esc(athleteOf(clash[1])?.name || clash[1].title)} overlap on ${esc(fmtDate(clash[0].start))}. Line up a driver.</p><button class="outline" data-action="go" data-tab="Rides">Plan the rides</button>`
      : `<span class="chip" style="background:#e4f2d2;color:#3f6a1c">ALL CLEAR</span><h3>No overlaps<br>this week.</h3><p>Nobody needs to be in two places at once.</p>`}</div>
      ${onePlaceCard(synced, teamCount)}`
    : `<div class="rail-card"><h2>Get set up</h2><ul class="checklist">
      ${checkItem(state.athletes.length, 'Add your athletes', 'add-athlete')}
      ${checkItem(state.teams.length, 'Add a team', 'add-team')}
      ${checkItem(state.events.length, 'Add or import events', state.teams.length ? 'go-teams' : 'add-event')}
      ${checkItem(state.members.length > 1, 'Invite your co-parent or family', 'invite')}</ul></div>`;

  return `${changesBannerHTML()}${hero}<div class="main-grid"><div class="panel">${calendarPanelHTML()}</div><aside class="rail">${rail}</aside></div>`;
}

// ---------------------------------------------------------------------------
// Schedule-change alerts
// ---------------------------------------------------------------------------
function changesSeenKey() { return `sidlne-changes-seen-${state.household.id}`; }
function unseenChanges() {
  let seen = '';
  try { seen = localStorage.getItem(changesSeenKey()) || ''; } catch {}
  return tidyChanges(state.changes.filter((c) => c.created_at > seen));
}

// One line per game. Some team apps change an event's ID on every sync, which
// looked like the game being cancelled and re-added: a "cancelled" for a game
// that's still on the calendar, or a "New" for one that flip-flopped, is dropped
function tidyChanges(list) {
  const min = (d) => Math.round(new Date(d).getTime() / 60000);
  const sig = (team, title, d) => `${team}|${String(title).trim().toLowerCase()}|${min(d)}`;
  const onCalendar = new Set(state.events.map((e) => sig(e.team_id, e.title, e.start)));
  const flipped = new Set(list.filter((c) => c.kind === 'cancelled').map((c) => sig(c.team_id, c.title, c.old_start)));
  const now = Date.now(), seen = new Set();
  return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at)).filter((c) => {
    const k = sig(c.team_id, c.title, c.new_start || c.old_start);
    if (new Date(c.new_start || c.old_start).getTime() < now - 3600000) return false;
    if (c.kind === 'cancelled' && onCalendar.has(k)) return false;
    if (c.kind === 'added' && flipped.has(k)) return false;
    if (seen.has(`${c.kind}|${k}`)) return false;
    seen.add(`${c.kind}|${k}`);
    return true;
  });
}

function describeChange(c) {
  const team = byId(state.teams, c.team_id);
  const who = byId(state.athletes, team?.athlete_id)?.name;
  const what = `${who ? who + ': ' : ''}${c.title}`;
  const when = (d) => `${fmtDate(d)} ${fmtTime(d)}`;
  if (c.kind === 'time') {
    const sameDay = key(new Date(c.old_start)) === key(new Date(c.new_start));
    return `${what} moved from ${when(c.old_start)} to ${sameDay ? fmtTime(c.new_start) : when(c.new_start)}`;
  }
  if (c.kind === 'location') return `${what} on ${fmtDate(c.new_start)} is now at ${c.new_location || 'a new location'}`;
  if (c.kind === 'cancelled') return `${what} on ${when(c.old_start)} was cancelled`;
  return `New: ${what} on ${when(c.new_start)}`;
}

const CHANGE_ICONS = { time: '⏰', location: '📍', cancelled: '✕', added: '✨' };

function changesBannerHTML() {
  const list = unseenChanges();
  if (!list.length) return '';
  return `<div class="changes-banner"><div class="changes-head"><span class="eyebrow">SCHEDULE CHANGES</span><button class="link-btn" data-action="seen-changes">Got it</button></div>
    <ul>${list.slice(0, state.allChanges ? 50 : 3).map((c) => {
      const text = `<i>${CHANGE_ICONS[c.kind] || '•'}</i>${esc(describeChange(c))}`;
      return `<li class="change-${c.kind}">${c.event_id && byId(state.events, c.event_id) ? `<button class="text-btn" data-action="open-event" data-id="${c.event_id}">${text}</button>` : `<span>${text}</span>`}</li>`;
    }).join('')}</ul>${list.length > 3 && !state.allChanges ? `<button class="link-btn more" data-action="all-changes">+${list.length - 3} more</button>` : ''}</div>`;
}

// The most recent change to an event in the last week, for markers on the event itself
function recentChange(eventId) {
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  return state.changes.find((c) => c.event_id === eventId && c.created_at > since);
}
function changeMarker(eventId) {
  const c = recentChange(eventId);
  if (!c) return '';
  const label = { time: '⏰ Time changed', location: '📍 Location changed', added: '✨ Just added' }[c.kind];
  return label ? `<p class="changed">${label}</p>` : '';
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

// "Are you going?": one answer per athlete per event
const RSVP = { going: { label: 'Going', icon: '✓' }, maybe: { label: 'Maybe', icon: '?' }, not_going: { label: 'Not going', icon: '✕' } };
function rsvpAthletes(e) { const a = athleteOf(e); return a ? [a] : state.athletes; }
function rsvpOf(eventId, athleteId) { return state.attendance.find((r) => r.event_id === eventId && r.athlete_id === athleteId)?.status; }

function rsvpLine(e) {
  const who = rsvpAthletes(e);
  const answers = who.map((a) => [a, rsvpOf(e.id, a.id)]).filter(([, s]) => RSVP[s]);
  if (answers.length) return `<p class="rsvp-line">${answers.map(([a, s]) => `<span class="rsvp-${s}">${RSVP[s].icon} ${esc(a.name)} ${esc(RSVP[s].label.toLowerCase())}</span>`).join(' · ')}</p>`;
  return who.length && new Date(e.start) > Date.now() ? '<p class="rsvp-line ask">Are you going?</p>' : '';
}

function eventHTML(e) {
  const t = fmtTime(e.start).split(' ');
  const a = athleteOf(e), team = byId(state.teams, e.team_id);
  const ride = rideFor(e.id);
  return `<button class="event" data-action="open-event" data-id="${e.id}"><span class="time"><strong>${esc(t[0])}</strong><small>${esc(t[1] || '')}</small></span><i class="bar" style="--c:${esc(colorOf(e))}"></i><span>${a || team?.sport ? `<small class="tag" style="--c:${esc(colorOf(e))}">${esc([a?.name, team?.sport].filter(Boolean).join(' · '))}</small>` : ''}<h3>${esc(e.title)}</h3>${team ? `<p>${esc(team.name)}</p>` : ''}${e.location ? `<p>⌖ ${esc(e.location)}</p>` : ''}${ride?.driver_profile_id ? `<p>🚗 ${esc(memberName(ride.driver_profile_id))} driving</p>` : ''}${changeMarker(e.id)}${carpoolLine(e) ? `<p>🚙 ${esc(carpoolLine(e))}</p>` : ''}${rsvpLine(e)}</span><small class="source">${e.source === 'ical' ? 'Team calendar' : ''}</small></button>`;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------
// The team app a calendar link comes from, e.g. "TeamSnap"
const CALENDAR_SOURCES = [
  [/teamsnap/, 'TeamSnap'], [/sportsengine|sportngin|ngin\.com/, 'SportsEngine'], [/leagueapps/, 'LeagueApps'],
  [/gamechanger|(^|\.)gc\.com$/, 'GameChanger'], [/sportsconnect|stacksports|bluesombrero/, 'Sports Connect'], [/crossbar/, 'Crossbar'],
  [/playmetrics/, 'PlayMetrics'], [/spond/, 'Spond'], [/heja/, 'Heja'], [/teamlinkt/, 'TeamLinkt'], [/demosphere/, 'Demosphere'],
  [/byga/, 'BYGA'], [/teamapp/, 'Team App'], [/google\.com/, 'Google Calendar'], [/icloud\.com/, 'Apple Calendar'],
  [/outlook|office365|live\.com/, 'Outlook'],
];
function calendarSource(url) {
  let host = '';
  try { host = new URL(String(url).trim().replace(/^webcals?:\/\//i, 'https://')).hostname.toLowerCase(); } catch { return null; }
  return CALENDAR_SOURCES.find(([re]) => re.test(host))?.[1] || null;
}

const APP_ABBR = { TeamSnap: 'TS', SportsEngine: 'SE', LeagueApps: 'LA', GameChanger: 'GC', 'Sports Connect': 'SC', Crossbar: 'CB', PlayMetrics: 'PM', Spond: 'SP', Heja: 'HJ', TeamLinkt: 'TL', Demosphere: 'DS', BYGA: 'BY', 'Team App': 'TA', 'Google Calendar': 'GO', 'Apple Calendar': 'AP', Outlook: 'OL' };

// The family's team apps (grouped by where each team's calendar comes from), with sync status
function appsHTML() {
  const groups = new Map();
  for (const t of state.teams) {
    const name = t.calendar_url ? calendarSource(t.calendar_url) || 'Team calendar' : 'Added by hand';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(t);
  }
  const order = [...groups.keys()].sort((a, b) => (a === 'Added by hand') - (b === 'Added by hand') || a.localeCompare(b));
  const rows = order.map((name) => {
    const teams = groups.get(name);
    const manual = name === 'Added by hand';
    const broken = teams.some((t) => t.calendar_url && t.last_sync_error);
    const status = manual ? '<span class="status muted">MANUAL</span>'
      : broken ? '<span class="status bad">● SYNC PROBLEM</span>'
      : teams.some((t) => t.last_synced_at) ? '<span class="status">● ACTIVE</span>' : '<span class="status">● CONNECTING</span>';
    const abbr = manual ? '✎' : APP_ABBR[name] || name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    return `<div class="app-row"><span class="app-logo">${esc(abbr)}</span><span><strong>${esc(name)}</strong><small>${teams.length} ${teams.length === 1 ? 'team' : 'teams'} · ${esc(teams.map((t) => t.name).join(', '))}</small></span>${status}</div>`;
  }).join('');
  const connected = new Set(order);
  const more = ['TeamSnap', 'SportsEngine', 'GameChanger', 'LeagueApps', 'Sports Connect', 'Crossbar'].filter((n) => !connected.has(n));
  return `<div class="apps section"><div class="panel-head" style="padding:0 0 10px"><h2>Your connected apps</h2><span class="source">Synced automatically</span></div>
    ${rows || '<p class="subtitle">No team apps connected yet. Add a team and paste its calendar link from TeamSnap, SportsEngine, GameChanger and more.</p>'}
    ${more.length ? `<p class="works-with">Also works with ${more.map((n) => `<b>${esc(n)}</b>`).join(', ')} and any team calendar link.</p>` : ''}
    <div class="row-actions"><button class="primary" data-action="add-team">＋ Connect a team app</button></div></div>`;
}

function appsPageHTML() {
  const apps = connectedApps();
  const synced = state.teams.filter((t) => t.calendar_url).length;
  const badges = apps.length ? apps : ['TeamSnap', 'SportsEngine', 'LeagueApps', 'GameChanger', 'Sports Connect', 'Crossbar'];
  const title = apps.length > 1 ? `${esc(NUMBER_WORDS[apps.length] || String(apps.length)).replace(/^./, (c) => c.toUpperCase())} apps.<br>One calendar.`
    : apps.length ? 'One app down.<br>Bring the rest.' : 'Five apps?<br>Make it one.';
  const text = synced
    ? `${synced} of ${state.teams.length} ${state.teams.length === 1 ? 'team syncs' : 'teams sync'} on ${apps.length === 1 ? esc(apps[0]) : 'their own'}. No more checking every app.`
    : 'Paste a team’s calendar link and SIDLNE keeps it in sync. No more checking every app.';
  return `${heroCard({ eyebrow: 'YOUR APPS', title, extra: `<div class="app-badges">${badges.map(appBadge).join('')}</div>`, text, actions: '<button class="primary" data-action="add-team">＋ Connect a team app</button>', ghost: 'APPS' })}
    ${appsHTML()}
    <div class="rail-card"><h2>Where do I find a team’s calendar link?</h2><p><strong>TeamSnap:</strong> Schedule → Export → Subscribe, copy the link.<br><strong>SportsEngine:</strong> Team page → Calendar → Subscribe → copy iCal link.<br><strong>LeagueApps / Sports Connect / Crossbar / GameChanger:</strong> look for “Subscribe”, “Sync calendar” or “iCal”.<br>Links starting with <code>webcal://</code> work too.</p></div>`;
}

function teamsHTML() {
  const athletes = state.athletes.length
    ? state.athletes.map((a) => `<button class="athlete-chip" data-action="edit-athlete" data-id="${a.id}"><i class="dot" style="background:${esc(a.color)}"></i>${esc(a.name)}</button>`).join('')
    : '<p class="subtitle">Add each kid (or adult) whose schedule you track.</p>';
  const shared = sharedLinks();
  const solo = state.teams.filter((t) => !shared.some((g) => g.teams.includes(t)));
  const cards = [...shared.map(sharedLinkCard), ...solo.map(teamCard)].join('');
  const teams = state.teams.length
    ? `<div class="teams">${cards}</div>`
    : '<div class="panel empty"><h3>No teams yet.</h3><p>Add a team to color-code events and import its schedule.</p></div>';
  return `<div class="section"><div class="section-head"><h2>Athletes</h2><button class="outline" data-action="add-athlete">＋ Add athlete</button></div><div class="athlete-chips">${athletes}</div></div>
    <div class="section"><div class="section-head"><h2>Teams</h2><button class="outline" data-action="add-team">＋ Add team</button></div>${teams}</div>
    <div class="rail-card"><h2>Team apps</h2><p>See which apps your teams sync from, and connect more.</p><button class="link-btn" data-action="go" data-tab="Apps">Open Apps →</button></div>`;
}

function syncLine(t) {
  if (!t.calendar_url) return 'No calendar link · add events by hand';
  const src = calendarSource(t.calendar_url);
  if (t.last_sync_error) return `<span class="sync-err">● Sync problem</span> · ${esc(t.last_sync_error)}`;
  if (t.last_synced_at) return `<span class="sync-ok">● ${src ? `Synced from ${esc(src)}` : 'Calendar linked'}</span> · ${esc(fmtDate(t.last_synced_at))} ${esc(fmtTime(t.last_synced_at))}`;
  return `<span class="sync-ok">● ${src ? `Linked to ${esc(src)}` : 'Calendar linked'}</span> · not synced yet`;
}

function upcomingCount(teamId) {
  const now = Date.now();
  return state.events.filter((e) => e.team_id === teamId && new Date(e.start).getTime() >= now).length;
}

function teamCard(t) {
  const a = byId(state.athletes, t.athlete_id);
  const unsorted = t.unsorted_titles?.length || 0;
  return `<div class="team-card"><div class="team-icon">${SPORT_ICONS[t.sport] || '🏅'}</div><h2>${esc(t.name)}</h2><p>${esc([a?.name, t.sport].filter(Boolean).join(' · ') || 'No athlete assigned')}</p>
    ${unsorted ? `<button class="sort-alert" data-action="sort-calendar" data-id="${t.id}">● ${unsorted} new ${unsorted === 1 ? 'event name' : 'event names'} to sort</button>` : ''}
    <p class="meta">${syncLine(t)}</p>
    <div class="row-actions">${t.calendar_url ? `<button class="outline" data-action="sync-team" data-id="${t.id}">Sync now</button>` : ''}<button class="outline" data-action="edit-team" data-id="${t.id}">Edit</button>${t.calendar_url ? `<button class="link-btn" data-action="sort-calendar" data-id="${t.id}">Sort or split events</button>` : ''}${a ? `<button class="link-btn" data-action="filter-athlete" data-id="${a.id}">View lineup</button>` : ''}</div></div>`;
}

// One club calendar (Crossbar, SportsEngine...) feeding several kids or sports
function sharedLinkCard(g) {
  const lead = g.teams[0];
  const host = (() => { try { return new URL(String(lead.calendar_url).trim().replace(/^webcals?:\/\//i, 'https://')).hostname.replace(/^www\./, ''); } catch { return 'Team calendar'; } })();
  const src = calendarSource(lead.calendar_url) || host;
  const unsorted = new Set(g.teams.flatMap((t) => t.unsorted_titles || [])).size;
  const rows = g.teams.map((t) => {
    const a = byId(state.athletes, t.athlete_id);
    const n = upcomingCount(t.id);
    return `<div class="split-row"><span class="split-icon" style="--kid:${esc(a?.color || '#9aa391')}">${SPORT_ICONS[t.sport] || '🏅'}</span><span class="grow"><strong>${esc(a?.name || 'No athlete')} · ${esc(t.sport || t.name)}</strong><span class="sub">${esc(t.name)} · ${n} upcoming</span></span><button class="link-btn" data-action="edit-team" data-id="${t.id}">Edit</button></div>`;
  }).join('');
  return `<div class="team-card link-card"><div class="link-head"><span class="app-logo">${esc(APP_ABBR[src] || src.slice(0, 2).toUpperCase())}</span><span class="grow"><h2>${esc(src)} calendar</h2><p>One link · ${g.teams.length} kids and sports</p></span></div>
    ${unsorted ? `<button class="sort-alert" data-action="sort-calendar" data-id="${lead.id}">● ${unsorted} new ${unsorted === 1 ? 'event name' : 'event names'} to sort</button>` : ''}
    <div class="split-list">${rows}</div>
    <p class="meta">${syncLine(g.teams.find((t) => t.last_sync_error) || lead)}</p>
    <div class="row-actions"><button class="${unsorted ? 'primary' : 'outline'}" data-action="sort-calendar" data-id="${lead.id}">Sort events</button><button class="outline" data-action="sync-link" data-id="${lead.id}">Sync now</button><button class="link-btn" data-action="add-from-link" data-id="${lead.id}">＋ Add a kid or sport</button></div></div>`;
}

// ---------------------------------------------------------------------------
// Sorting a shared calendar between kids and sports. Mirrors
// supabase/functions/sync-calendar/sorting.ts; keep the two in step.
function normTitle(title) {
  return String(title || '').toLowerCase().replace(/\d+/g, '#').replace(/[^a-z#]+/g, ' ').trim();
}
function linkKey(url) {
  return String(url || '').trim().replace(/^[a-z]+:\/\//i, '').replace(/\/+$/, '').toLowerCase();
}
function filterWords(filter) {
  return String(filter || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
}
function belongsTo(team, siblings, title) {
  const p = normTitle(title);
  if (siblings.some((s) => s.hidden_titles?.includes(p))) return false;
  const owner = siblings.find((s) => s.event_titles?.includes(p));
  if (owner) return owner.id === team.id;
  const words = filterWords(team.event_filter);
  if (!team.event_titles?.length && !words.length) return siblings.length <= 1;
  return words.some((w) => String(title).toLowerCase().includes(w));
}
function linkTeams(teamId) {
  const t = byId(state.teams, teamId);
  return t?.calendar_url ? state.teams.filter((x) => x.calendar_url && linkKey(x.calendar_url) === linkKey(t.calendar_url)) : [];
}
function sharedLinks() {
  const groups = new Map();
  for (const t of state.teams) {
    if (!t.calendar_url) continue;
    const k = linkKey(t.calendar_url);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(t);
  }
  return [...groups.values()].filter((teams) => teams.length > 1).map((teams) => ({ teams }));
}

function teamLabel(t) {
  const a = byId(state.athletes, t.athlete_id);
  return [a?.name, t.sport && t.sport !== 'Other' ? t.sport : t.name].filter(Boolean).join(' · ') + (t.sport && t.sport !== 'Other' && t.name ? ` (${t.name})` : '');
}

async function sortCalendar(teamId) {
  const teams = linkTeams(teamId);
  if (!teams.length) return;
  showModal('<span class="eyebrow">SORT EVENTS</span><h2>Reading the calendar…</h2><p class="subtitle">Looking up every event name in this link.</p><div class="loading-bar"></div>');
  const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { preview_url: teams[0].calendar_url } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    showModal(`<span class="eyebrow">SORT EVENTS</span><h2>Couldn’t read that calendar</h2><p>${esc(msg)}</p>`);
    return;
  }
  state.sorting = { teamId, names: data.names || [] };
  renderSorter();
}

function renderSorter() {
  const { teamId, names } = state.sorting;
  const teams = linkTeams(teamId);
  const src = calendarSource(teams[0].calendar_url) || 'Team';
  const rows = names.map((n, i) => {
    const hidden = teams.some((t) => t.hidden_titles?.includes(n.pattern));
    const owners = hidden ? [] : teams.filter((t) => belongsTo(t, teams, n.title));
    const pick = hidden ? 'hide' : owners[0]?.id || '';
    const when = n.next ? `next ${fmtDate(n.next)}` : 'past';
    return { n, i, pick, unsorted: !hidden && !owners.length, clash: owners.length > 1, when };
  }).sort((a, b) => b.unsorted - a.unsorted || b.clash - a.clash);
  const left = rows.filter((r) => r.unsorted).length;
  const options = (pick) => `${pick ? '' : '<option value="" selected>Choose who it’s for…</option>'}${teams.map((t) => `<option value="${t.id}" ${pick === t.id ? 'selected' : ''}>${esc(teamLabel(t))}</option>`).join('')}<option value="hide" ${pick === 'hide' ? 'selected' : ''}>Don’t show</option>`;
  showModal(`<span class="eyebrow">SORT EVENTS · ${esc(src.toUpperCase())}</span><h2>Who’s each event for?</h2>
    <p>This link has ${names.length} different event ${names.length === 1 ? 'name' : 'names'}. Pick a kid and sport for each one. New events with the same name will go to the same place automatically.</p>
    ${left ? `<p class="sort-alert static">● ${left} still to sort</p>` : '<p class="sort-ok">✓ Everything has a home</p>'}
    <form class="form sorter" data-form="sort">
      <div class="sort-list">${rows.map((r) => `<label class="sort-row ${r.unsorted ? 'todo' : ''} ${r.clash ? 'clash' : ''}"><span class="sort-name"><strong>${esc(r.n.title)}</strong><small>${r.n.count} ${r.n.count === 1 ? 'event' : 'events'} · ${esc(r.when)}${r.clash ? ' · was on 2 teams' : ''}</small></span><select name="n${r.i}">${options(r.pick)}</select></label>`).join('')}</div>
      <details class="sort-words"><summary>Auto-sort by word (optional)</summary><p class="hint">Also send new event names containing these words to a team, e.g. WYFH for every field hockey game. Separate words with commas.</p>
        ${teams.map((t) => `<label>${esc(teamLabel(t))}<input name="w${t.id}" maxlength="120" value="${esc(t.event_filter || '')}" placeholder="e.g. WYFH, 7 Blue"></label>`).join('')}</details>
      <button class="primary full" type="submit">Save and sync</button></form>
    <div class="row-actions"><button class="link-btn" data-action="add-from-link" data-id="${teamId}">＋ Add another kid or sport from this calendar</button></div>`);
}

function athleteForm(a) {
  const color = a?.color || COLORS[state.athletes.length % COLORS.length];
  showModal(`<span class="eyebrow">ATHLETE</span><h2>${a ? 'Edit athlete' : 'Add an athlete'}</h2>
    <form class="form" data-form="athlete" data-id="${a?.id || ''}"><label>Name<input name="name" required maxlength="60" value="${esc(a?.name)}"></label>
    <label>Color<select name="color">${COLORS.map((c, i) => `<option value="${c}" ${c === color ? 'selected' : ''}>${['Violet', 'Blue', 'Orange', 'Green', 'Pink', 'Gold', 'Teal', 'Olive'][i]}</option>`).join('')}</select></label>
    <button class="primary full" type="submit">${a ? 'Save' : 'Add athlete'}</button></form>
    ${a ? `<div class="row-actions"><button class="danger-btn" data-action="delete-athlete" data-id="${a.id}">Remove ${esc(a.name)}</button></div>` : ''}`);
}

function teamForm(t, link) {
  showModal(`<span class="eyebrow">TEAM</span><h2>${t ? 'Edit team' : 'Add a team'}</h2>
    <form class="form" data-form="team" data-id="${t?.id || ''}"><label>Team name<input name="name" required maxlength="80" value="${esc(t?.name)}" placeholder="Northside U12 Lacrosse"></label>
    <div class="form-grid"><label>Athlete<select name="athlete_id"><option value="">—</option>${state.athletes.map((a) => `<option value="${a.id}" ${t?.athlete_id === a.id ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <label>Sport<select name="sport"><option value="">—</option>${SPORTS.map((s) => `<option ${t?.sport === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label></div>
    <label>Calendar link (optional)<input name="calendar_url" type="text" inputmode="url" value="${esc(t?.calendar_url || link || '')}" placeholder="webcal://… or https://….ics"><small class="hint">We’ll import the schedule and keep it up to date automatically.</small></label>
    <small class="hint">One club calendar for several kids or sports (Crossbar, SportsEngine…)? Add a team for each with the same link, then use <strong>Sort events</strong> to pick who each event is for.</small>
    <button class="primary full" type="submit">${t ? 'Save team' : 'Add team'}</button></form>
    ${t ? `<div class="row-actions"><button class="danger-btn" data-action="delete-team" data-id="${t.id}">Delete team and its imported events</button></div>` : ''}`);
}

async function invokeSync(id) {
  state.syncAttempts[id] = Date.now();
  const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { team_id: id } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return data;
}

async function syncTeam(id, quiet) {
  let data;
  try { data = await invokeSync(id); } finally { await reload('teams').catch(() => {}); }
  await reload('events', 'changes');
  if (!quiet) toast(`Imported ${data.imported} ${data.imported === 1 ? 'event' : 'events'}`);
  renderMain();
}

// Keep team calendars current: whenever the app opens or comes back to the
// foreground, re-import any calendar that hasn't synced in the last hour.
const AUTO_SYNC_MS = 60 * 60 * 1000;
const RETRY_MS = 15 * 60 * 1000;

async function autoSync() {
  if (state.syncing || !state.household || !navigator.onLine) return;
  const now = Date.now();
  const due = state.teams.filter((t) => t.calendar_url
    && (!t.last_synced_at || now - new Date(t.last_synced_at) > AUTO_SYNC_MS)
    && !(now - (state.syncAttempts[t.id] || 0) < RETRY_MS));
  if (!due.length) return;
  state.syncing = true;
  try {
    for (const t of due) {
      try { await invokeSync(t.id); } catch (err) { console.warn(`Calendar sync failed for ${t.name}:`, err.message); }
    }
    await reload('events', 'teams', 'changes');
    if (state.tab !== 'Chat') renderMain();
  } catch (err) {
    console.error(err);
  } finally {
    state.syncing = false;
  }
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
    <label>Team<select name="team_id" ${e?.source === 'ical' && e.team_id ? 'disabled title="Set by the team calendar"' : ''}><option value="">—</option>${state.teams.map((t) => `<option value="${t.id}" ${e?.team_id === t.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label></div>
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
    : carpoolLine(e) ? '' : '🚗 No driver yet';
  showModal(`<span class="eyebrow">${esc([a?.name, team?.sport].filter(Boolean).join(' · ') || 'EVENT')}</span><h2>${esc(e.title)}</h2>${team ? `<p>${esc(team.name)}</p>` : ''}
    <div class="info"><div>◷ ${esc(fmtLong(e.start))} · ${esc(fmtTime(e.start))}${e.end ? '–' + esc(fmtTime(e.end)) : ''}</div>${e.location ? `<div>⌖ <a href="${esc(wazeUrl(e.location))}" target="_blank" rel="noopener">${esc(e.location)}</a></div>` : ''}${rideLine ? `<div>${rideLine}</div>` : ''}${e.source === 'ical' ? '<div>↻ Imported from team calendar</div>' : ''}${changeDetail(e.id)}${carpoolLine(e) ? `<div>🚙 ${esc(carpoolLine(e))}</div>` : ''}</div>
    ${rsvpHTML(e)}
    ${e.description ? `<p style="white-space:pre-wrap">${esc(e.description)}</p>` : ''}
    <div class="row-actions">${directionsButton(e.location, 'primary')}${gameDayButton(e.athlete_id)}</div>
    <div class="row-actions">${ride?.driver_profile_id === me ? `<button class="outline" data-action="release-ride" data-id="${e.id}">I can’t drive</button>` : `<button class="primary" data-action="claim-ride" data-id="${e.id}">${ride?.driver_profile_id ? 'I’ll drive instead' : 'I’ll drive'}</button>`}
    <button class="outline" data-action="edit-event" data-id="${e.id}">Edit</button><button class="danger-btn" data-action="delete-event" data-id="${e.id}">Delete</button></div>`);
}

function changeDetail(eventId) {
  const c = recentChange(eventId);
  if (c?.kind === 'time') return `<div class="changed">⏰ Moved from ${esc(fmtDate(c.old_start))} ${esc(fmtTime(c.old_start))}</div>`;
  if (c?.kind === 'location') return `<div class="changed">📍 Was at ${esc(c.old_location || 'another location')}</div>`;
  return '';
}

function rsvpHTML(e) {
  const who = rsvpAthletes(e);
  if (!who.length) return '';
  return `<div class="rsvp"><h3>Are you going?</h3>${who.map((a) => {
    const cur = rsvpOf(e.id, a.id);
    return `<div class="rsvp-row"><span class="rsvp-name"><i class="dot" style="background:${esc(a.color)}"></i>${esc(a.name)}</span><div class="segmented">${Object.entries(RSVP).map(([k, v]) => `<button class="${cur === k ? `active rsvp-${k}` : ''}" data-action="rsvp" data-event="${e.id}" data-athlete="${a.id}" data-status="${k}" aria-pressed="${cur === k}">${v.label}</button>`).join('')}</div></div>`;
  }).join('')}</div>`;
}

// Tapping the current answer again clears it
async function setRsvp(eventId, athleteId, status) {
  if (rsvpOf(eventId, athleteId) === status) {
    must(await supabase.from('event_attendance').delete().eq('event_id', eventId).eq('athlete_id', athleteId));
  } else {
    must(await supabase.from('event_attendance').upsert(
      { event_id: eventId, athlete_id: athleteId, status, updated_by: state.session.user.id, updated_at: new Date().toISOString() },
      { onConflict: 'event_id,athlete_id' },
    ));
  }
  await reload('attendance');
  renderMain();
}

// ---------------------------------------------------------------------------
// Rides
// ---------------------------------------------------------------------------
function gameDayStrip(open = 0, total = 0) {
  const title = !total ? 'Nothing to drive.<br>Yet.' : open ? `${NUMBER_WORDS[open] ? NUMBER_WORDS[open].replace(/^./, (c) => c.toUpperCase()) : open} ${open === 1 ? 'drive needs' : 'drives need'}<br>a driver.` : 'Every drive.<br>Covered.';
  const text = open ? 'Claim one below, or split the driving with a carpool.' : '🎧 Driving to a game? Get the car pumped up.';
  return heroCard({ eyebrow: 'RIDES · NEXT 14 DAYS', title, text, actions: `${gameDayButton('', 'primary')}`, ghost: 'GO' });
}

function ridesHTML() {
  if (state.carpoolId) return carpoolPageHTML();
  const list = upcoming(14);
  const me = state.session.user.id;
  if (!list.length) return `${gameDayStrip(0, 0)}${carpoolListHTML()}<div class="panel empty"><h3>No events in the next two weeks.</h3><p>When events are on the calendar, you can claim drives here.</p></div>`;
  const open = list.filter((e) => !driveStatus(e).ok).length;
  return `${gameDayStrip(open, list.length)}${carpoolListHTML()}<div class="section-head"><h2>Family drives</h2></div><div class="list-card"><div class="panel-head" style="padding:16px 0 4px"><h2>Next 14 days</h2><span class="pill ${open ? 'warn' : 'ok'}">${open ? `${open} NEED${open === 1 ? 'S' : ''} A DRIVER` : 'ALL COVERED'}</span></div>
    ${list.map((e) => {
      const ride = rideFor(e.id), a = athleteOf(e);
      const driver = ride?.driver_profile_id;
      return `<div class="list-row"><span class="avatar" style="background:${esc(colorOf(e))};color:#fff">${initials(a?.name || e.title)}</span><span class="grow"><strong>${esc(e.title)}</strong><span class="sub">${esc(fmtDate(e.start))} · ${esc(fmtTime(e.start))}${e.location ? ' · ' + esc(e.location) : ''}</span></span>
        ${driver ? `<span class="pill ok">${esc(memberName(driver).toUpperCase())}${driver === me ? '' : ' DRIVING'}</span>` : (() => { const d = driveStatus(e); return `<span class="pill ${d.ok ? 'ok' : 'warn'}">${esc(d.label.replace(/^NEEDS A DRIVER$/, 'NEEDS DRIVER'))}</span>`; })()}
        ${driver === me ? `<button class="outline" data-action="release-ride" data-id="${e.id}">Release</button>` : `<button class="outline" data-action="claim-ride" data-id="${e.id}">I’ll drive</button>`}${directionsButton(e.location)}</div>`;
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
// Carpools: a team's schedule shared with other families, with a drop-off and
// a pick-up driver for every event
// ---------------------------------------------------------------------------
const LEGS = { to: 'Drop-off', from: 'Pick-up' };
const CARPOOL_DAYS = 30;
const CARPOOL_KEY = 'sidlne-carpool';

// Carpools you can see (your family's, and ones you joined), with members and rides.
// Tolerant of a database without the carpool tables, so the app still loads.
async function fetchCarpools() {
  const { data: carpools, error } = await supabase.from('carpools').select('*').order('created_at');
  if (error) { console.warn('Carpools unavailable:', error.message); return { carpools: [], members: [], rides: [] }; }
  if (!carpools.length) return { carpools: [], members: [], rides: [] };
  const ids = carpools.map((c) => c.id);
  const [members, rides] = await Promise.all([
    supabase.from('carpool_members').select('*').in('carpool_id', ids).order('created_at'),
    supabase.from('carpool_rides').select('*').in('carpool_id', ids),
  ]);
  return { carpools, members: must(members), rides: must(rides) };
}

async function loadCarpools() {
  const r = await fetchCarpools();
  state.carpools = r.carpools;
  state.carpoolMembers = r.members;
  state.carpoolRides = r.rides;
}

function carpoolMember(id) { return state.carpoolMembers.find((m) => m.id === id); }
function myCarpoolMember(cid) { return state.carpoolMembers.find((m) => m.carpool_id === cid && m.profile_id === state.session.user.id); }
function carpoolDriver(cid, eventId, leg) {
  const r = state.carpoolRides.find((x) => x.carpool_id === cid && x.event_id === eventId && x.leg === leg);
  return r?.driver_member_id ? carpoolMember(r.driver_member_id) : null;
}
function ownsCarpool(c) { return c.household_id === state.household?.id; }

// "Dana drops off · Lee picks up" for an event in one of your family's carpools
// A carpool can cover only events whose title contains one of its comma-separated words
function carpoolCovers(c, title) {
  const words = String(c.event_filter || '').split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
  return !words.length || words.some((w) => String(title).toLowerCase().includes(w));
}

// Drop-off and pick-up drivers from this family's carpools covering the event
function carpoolDrivers(e) {
  for (const c of state.carpools) {
    if (c.team_id !== e.team_id || !ownsCarpool(c) || !carpoolCovers(c, e.title)) continue;
    const to = carpoolDriver(c.id, e.id, 'to'), from = carpoolDriver(c.id, e.id, 'from');
    if (to || from) return { to, from };
  }
  return { to: null, from: null };
}

function carpoolLine(e) {
  const { to, from } = carpoolDrivers(e);
  if (!to && !from) return '';
  return [to && `${to.name} drops off`, from && `${from.name} picks up`].filter(Boolean).join(' · ');
}

// Who's driving, from a family ride or the carpool: { ok, label } for chips and pills
function driveStatus(e) {
  const ride = rideFor(e.id);
  if (ride?.driver_profile_id) return { ok: true, label: `🚗 ${memberName(ride.driver_profile_id)} driving` };
  const { to, from } = carpoolDrivers(e);
  if (to && from) return { ok: true, label: to.id === from.id ? `🚙 ${to.name} driving` : `🚙 ${to.name} · ${from.name}` };
  if (to) return { ok: false, label: `🚙 ${to.name} drops off · NEEDS PICK-UP` };
  if (from) return { ok: false, label: `🚙 ${from.name} picks up · NEEDS DROP-OFF` };
  return { ok: false, label: 'NEEDS A DRIVER' };
}

function carpoolListHTML() {
  const cards = state.carpools.map((c) => {
    const n = state.carpoolMembers.filter((m) => m.carpool_id === c.id).length;
    return `<button class="carpool-card" data-action="open-carpool" data-id="${c.id}"><strong>🚙 ${esc(c.name)}</strong><span class="sub">${n} ${n === 1 ? 'driver' : 'drivers'}${ownsCarpool(c) ? '' : ' · shared with you'}</span><span class="go">Open →</span></button>`;
  }).join('');
  return `<div class="section"><div class="section-head"><h2>Carpools</h2><div class="head-actions">${state.teams.length ? '<button class="outline" data-action="new-carpool">＋ Start a carpool</button>' : ''}<button class="link-btn" data-action="join-carpool">Join with a code</button></div></div>
    ${cards ? `<div class="carpool-cards">${cards}</div>` : '<p class="subtitle">Share a team’s schedule with other parents and take turns driving. Start one for a team, or join one with a code.</p>'}</div>`;
}

async function carpoolSchedule(cid) {
  const { data, error } = await supabase.rpc('carpool_schedule', { cid });
  if (error) throw error;
  const until = Date.now() + CARPOOL_DAYS * DAY;
  return data.filter((e) => new Date(e.start) <= until);
}

async function openCarpool(id) {
  state.carpoolId = id;
  state.carpoolEvents = await carpoolSchedule(id);
  subscribeCarpool(id);
  if (state.tab !== 'Rides') go('Rides'); else renderMain();
}

function closeCarpool() {
  state.carpoolId = null;
  if (state.carpoolChannel) { supabase.removeChannel(state.carpoolChannel); state.carpoolChannel = null; }
  renderMain();
}

function subscribeCarpool(id) {
  if (state.carpoolChannel) supabase.removeChannel(state.carpoolChannel);
  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(async () => { try { await loadCarpools(); if (state.carpoolId === id && state.tab === 'Rides') renderMain(); } catch (err) { console.error(err); } }, 250); };
  state.carpoolChannel = supabase.channel(`carpool-${id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'carpool_rides', filter: `carpool_id=eq.${id}` }, refresh)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'carpool_members', filter: `carpool_id=eq.${id}` }, refresh)
    .subscribe();
}

function carpoolPageHTML() {
  const c = state.carpools.find((x) => x.id === state.carpoolId);
  if (!c) { state.carpoolId = null; return ridesHTML(); }
  const members = state.carpoolMembers.filter((m) => m.carpool_id === c.id);
  const me = myCarpoolMember(c.id);
  const events = state.carpoolEvents || [];
  const open = events.reduce((n, e) => n + Object.keys(LEGS).filter((leg) => !carpoolDriver(c.id, e.id, leg)).length, 0);
  const options = (sel) => `<option value="">— Needs a driver —</option>${members.map((m) => `<option value="${m.id}" ${sel?.id === m.id ? 'selected' : ''}>${esc(m.name)}${m.id === me?.id ? ' (me)' : ''}</option>`).join('')}`;
  const rows = events.length ? events.map((e) => `<div class="carpool-row"><div class="when"><strong>${esc(fmtDate(e.start))}</strong><span>${esc(fmtTime(e.start))}</span></div>
      <div class="what"><strong>${esc(e.title)}</strong>${e.location ? `<span>⌖ ${esc(e.location)}</span>` : ''}</div>
      ${Object.entries(LEGS).map(([leg, label]) => {
        const d = carpoolDriver(c.id, e.id, leg);
        return `<label class="leg ${d ? (d.id === me?.id ? 'mine' : 'set') : 'open'}"><span>${label}</span><select data-change="carpool-ride" data-carpool="${c.id}" data-event="${e.id}" data-leg="${leg}">${options(d)}</select></label>`;
      }).join('')}</div>`).join('')
    : `<div class="empty"><h3>No events in the next ${CARPOOL_DAYS} days.</h3><p>Events from the team’s calendar show up here automatically.</p></div>`;
  return `<button class="link-btn" data-action="close-carpool">← All rides</button>
    <div class="carpool-head"><div><span class="eyebrow">CARPOOL</span><h2>🚙 ${esc(c.name)}</h2><p class="subtitle">Next ${CARPOOL_DAYS} days${c.event_filter ? ` · only “${esc(c.event_filter)}” events` : ''} · <span class="pill ${open ? 'warn' : 'ok'}">${open ? `${open} ${open === 1 ? 'DRIVE' : 'DRIVES'} OPEN` : 'ALL COVERED'}</span></p></div>
      <div class="row-actions"><button class="primary" data-action="carpool-autofill" data-id="${c.id}">⚡ Auto-assign drivers</button><button class="outline" data-action="share-carpool" data-id="${c.id}">Invite parents</button><button class="outline" data-action="carpool-import" data-id="${c.id}">📄 Import Google Sheet</button><button class="outline" data-action="carpool-export" data-id="${c.id}">Export</button>${ownsCarpool(c) ? `<button class="outline" data-action="edit-carpool" data-id="${c.id}">✏️ Edit carpool</button>` : ''}</div></div>
    <div class="section"><div class="section-head"><h2>Drivers</h2><div class="head-actions">${me ? `<button class="link-btn" data-action="carpool-me" data-id="${c.id}">Edit my info</button>` : `<button class="outline" data-action="carpool-me" data-id="${c.id}">＋ Add me as a driver</button>`}${ownsCarpool(c) ? `<button class="link-btn" data-action="carpool-add-parent" data-id="${c.id}">＋ Add a parent</button>` : ''}</div></div>
      <div class="athlete-chips">${members.length ? members.map((m) => `<span class="athlete-chip">${esc(m.name)}${m.seats != null ? ` · ${m.seats} ${m.seats === 1 ? 'seat' : 'seats'}` : ''}${m.phone ? ` · <a href="tel:${esc(m.phone.replace(/[^\d+]/g, ''))}">${esc(m.phone)}</a>` : ''}${m.profile_id ? '' : ' <small class="sub">(not joined)</small>'}</span>`).join('') : '<p class="subtitle">No drivers yet. Invite the other parents.</p>'}</div></div>
    <div class="panel carpool-grid">${rows}</div>
    ${ownsCarpool(c) ? `<div class="row-actions"><button class="danger-btn" data-action="delete-carpool" data-id="${c.id}">Delete carpool</button></div>` : me ? `<div class="row-actions"><button class="danger-btn" data-action="leave-carpool" data-id="${c.id}">Leave carpool</button></div>` : ''}`;
}

function carpoolForm() {
  showModal(`<span class="eyebrow">NEW CARPOOL</span><h2>Start a carpool</h2><p>Other parents join with an invite link and see this team’s schedule. Everyone can sign up to drive.</p>
    <form class="form" data-form="carpool"><label>Team<select name="team_id" required>${state.teams.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join('')}</select></label>
    <label>Carpool name (optional)<input name="name" maxlength="80" placeholder="e.g. Field hockey carpool"></label>
    <label>Which events? (optional)<input name="event_filter" maxlength="120" placeholder="e.g. WYFH, field hockey"><small class="hint">Leave blank for all of the team’s events, or list words from event names (separated by commas) to include only those, e.g. just field hockey when a club calendar mixes sports.</small></label>
    <details class="sheet-import"><summary>📄 Already have a carpool Google Sheet? Import it</summary>
      <p class="hint">Use a sheet with a <b>Date</b> column and <b>Drop-off</b> / <b>Pick-up</b> (or one <b>Driver</b>) columns. Drivers are matched by name, and new names are added.</p>
      ${SHEET_FIELDS}</details>
    <button class="primary full" type="submit">Create carpool</button></form>`);
}

function carpoolEditForm(cid) {
  const c = state.carpools.find((x) => x.id === cid);
  showModal(`<span class="eyebrow">CARPOOL</span><h2>Edit carpool</h2>
    <form class="form" data-form="carpool-edit" data-id="${cid}"><label>Carpool name<input name="name" required maxlength="80" value="${esc(c.name)}"></label>
    <label>Which events?<input name="event_filter" maxlength="120" value="${esc(c.event_filter || '')}" placeholder="e.g. WYFH, field hockey"><small class="hint">Only events whose name contains one of these words (separated by commas). Leave blank for all of ${esc(byId(state.teams, c.team_id)?.name || 'the team')}’s events.</small></label>
    <button class="primary full" type="submit">Save</button></form>`);
}

function carpoolMeForm(cid) {
  const m = myCarpoolMember(cid);
  showModal(`<span class="eyebrow">CARPOOL</span><h2>${m ? 'Your driver info' : 'Add me as a driver'}</h2>
    <form class="form" data-form="carpool-me" data-id="${cid}"><label>Name<input name="name" required maxlength="60" value="${esc(m?.name || state.profile?.display_name || '')}"></label>
    <div class="form-grid"><label>Phone (optional)<input name="phone" type="tel" maxlength="30" value="${esc(m?.phone || '')}"></label><label>Seats for kids<input name="seats" type="number" min="0" max="12" value="${m?.seats ?? ''}"></label></div>
    <button class="primary full" type="submit">Save</button></form>`);
}

function carpoolAddParentForm(cid) {
  showModal(`<span class="eyebrow">CARPOOL</span><h2>Add a parent</h2><p>Add someone who hasn’t joined yet so you can assign them drives. When they join with the invite link using the same name, the drives become theirs.</p>
    <form class="form" data-form="carpool-parent" data-id="${cid}"><label>Name<input name="name" required maxlength="60"></label><label>Phone (optional)<input name="phone" type="tel" maxlength="30"></label>
    <button class="primary full" type="submit">Add parent</button></form>`);
}

function carpoolJoinForm(code = '') {
  showModal(`<span class="eyebrow">CARPOOL</span><h2>Join a carpool</h2><p>Enter the code another parent shared with you.</p>
    <form class="form" data-form="join-carpool"><label>Carpool code<input name="code" required maxlength="20" value="${esc(code)}" style="text-transform:uppercase"></label>
    <label>Your name<input name="name" required maxlength="60" value="${esc(state.profile?.display_name || '')}"></label>
    <div class="form-grid"><label>Phone (optional)<input name="phone" type="tel" maxlength="30"></label><label>Seats for kids<input name="seats" type="number" min="0" max="12"></label></div>
    <button class="primary full" type="submit">Join carpool</button></form>`);
}

const SHEET_FIELDS = `<label>Google Sheets link<input name="url" type="url" inputmode="url" placeholder="https://docs.google.com/spreadsheets/d/…"><small class="hint">In Google Sheets tap Share → General access → “Anyone with the link”, then Copy link.</small></label>
      <label>…or upload a file (.csv)<input name="file" type="file" accept=".csv,.tsv,.txt,text/csv"><small class="hint">Google Sheets: File → Download → Comma-separated values (.csv).</small></label>`;

// The sheet text from an uploaded file or a Google Sheets link (read by our server: Google blocks browsers)
async function readSheetInput(f) {
  const file = f.get('file');
  if (file && file.size) return file.text();
  const url = (f.get('url') || '').trim();
  if (!url) return '';
  const { data, error } = await supabase.functions.invoke('sync-calendar', { body: { sheet_url: url } });
  if (error) {
    let msg = error.message;
    try { msg = (await error.context.json()).error || msg; } catch {}
    throw new Error(msg);
  }
  return data.csv;
}

function importToast(r) {
  return `Imported ${r.rides} ${r.rides === 1 ? 'drive' : 'drives'}${r.added.length ? `, added ${r.added.join(', ')}` : ''}${r.skipped ? ` · ${r.skipped} rows didn’t match an event` : ''}`;
}

function carpoolImportForm(cid) {
  showModal(`<span class="eyebrow">IMPORT</span><h2>Import from Google Sheets</h2>
    <p>Use a sheet with a <b>Date</b> column and driver columns such as <b>Drop-off</b> and <b>Pick-up</b> (or one <b>Driver</b> column). Names are matched to drivers, and new names are added.</p>
    <form class="form" data-form="carpool-import" data-id="${cid}">
      ${SHEET_FIELDS}
      <button class="primary full" type="submit">Import</button></form>`);
}

async function setCarpoolRide(cid, eventId, leg, memberId) {
  if (memberId) {
    must(await supabase.from('carpool_rides').upsert({ carpool_id: cid, event_id: eventId, leg, driver_member_id: memberId, updated_by: state.session.user.id, updated_at: new Date().toISOString() }, { onConflict: 'carpool_id,event_id,leg' }));
  } else {
    must(await supabase.from('carpool_rides').delete().eq('carpool_id', cid).eq('event_id', eventId).eq('leg', leg));
  }
  await loadCarpools();
}

// Fill open drives so everyone drives about the same number of times
function planAutofill(cid) {
  const drivers = state.carpoolMembers.filter((m) => m.carpool_id === cid && m.seats !== 0);
  if (!drivers.length) return [];
  const count = new Map(drivers.map((m) => [m.id, 0]));
  for (const r of state.carpoolRides) if (r.carpool_id === cid && count.has(r.driver_member_id)) count.set(r.driver_member_id, count.get(r.driver_member_id) + 1);
  const plan = [];
  for (const e of state.carpoolEvents || []) {
    for (const leg of Object.keys(LEGS)) {
      if (carpoolDriver(cid, e.id, leg)) continue;
      const other = plan.find((p) => p.event_id === e.id)?.driver_member_id || carpoolDriver(cid, e.id, leg === 'to' ? 'from' : 'to')?.id;
      const pick = [...drivers].sort((a, b) => (count.get(a.id) - count.get(b.id)) || ((a.id === other) - (b.id === other)))[0];
      count.set(pick.id, count.get(pick.id) + 1);
      plan.push({ carpool_id: cid, event_id: e.id, leg, driver_member_id: pick.id, updated_by: state.session.user.id });
    }
  }
  return plan;
}

// --- Spreadsheet import / export -------------------------------------------
function parseCsv(text) {
  const delim = (text.split('\n')[0].match(/\t/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) { row.push(cell.trim()); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell.trim()); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows.filter((r) => r.some((c) => c));
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// A date written the way people type them in a sheet, as a local day key
function sheetDateKey(s) {
  s = String(s || '').trim().toLowerCase();
  if (!s) return null;
  const now = new Date();
  let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return key(new Date(+m[1], m[2] - 1, +m[3], 12));
  if ((m = /(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/.exec(s))) {
    let y = m[3] ? +m[3] : now.getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, m[1] - 1, +m[2], 12);
    if (!m[3] && d < now - 60 * DAY) d.setFullYear(y + 1);
    return key(d);
  }
  if ((m = /([a-z]{3})[a-z]*\.?\s+(\d{1,2})(?:\D+(\d{4}))?/.exec(s)) && MONTHS.includes(m[1])) {
    const d = new Date(m[3] ? +m[3] : now.getFullYear(), MONTHS.indexOf(m[1]), +m[2], 12);
    if (!m[3] && d < now - 60 * DAY) d.setFullYear(d.getFullYear() + 1);
    return key(d);
  }
  return null;
}

async function importCarpoolSheet(cid, text) {
  const rows = parseCsv(text);
  const headerAt = rows.findIndex((r) => r.some((c) => /date|day/i.test(c)));
  if (headerAt < 0) throw new Error('Couldn’t find a “Date” column in that sheet.');
  const head = rows[headerAt].map((h) => h.toLowerCase());
  const col = (re) => head.findIndex((h) => re.test(h));
  const cDate = col(/date|day/), cTime = col(/time|start/), cTitle = col(/event|game|practice|title|what/);
  let cTo = col(/drop|^to\b|there|morning|am\b/), cFrom = col(/pick|from|back|home|return|pm\b/);
  const cDriver = col(/driver|who|parent/);
  if (cTo < 0 && cFrom < 0 && cDriver < 0) throw new Error('Couldn’t find driver columns (for example “Drop-off”, “Pick-up” or “Driver”).');
  if (cTo < 0 && cFrom < 0) cTo = cFrom = cDriver;

  const events = state.carpoolEvents || [];
  const members = state.carpoolMembers.filter((m) => m.carpool_id === cid);
  const added = [];
  const findMember = async (name) => {
    const n = name.trim().replace(/\s+/g, ' ');
    if (!n || /^(-+|tbd|n\/?a|none|\?)$/i.test(n)) return null;
    const lower = n.toLowerCase();
    let m = members.find((x) => x.name.toLowerCase() === lower) || members.find((x) => x.name.toLowerCase().split(' ')[0] === lower.split(' ')[0]);
    if (m) return m;
    m = must(await supabase.from('carpool_members').insert({ carpool_id: cid, name: n.slice(0, 60) }).select().single());
    members.push(m); added.push(n);
    return m;
  };

  const upserts = [];
  let skipped = 0;
  for (const r of rows.slice(headerAt + 1)) {
    const dk = sheetDateKey(r[cDate]);
    let candidates = dk ? events.filter((e) => key(new Date(e.start)) === dk) : [];
    if (candidates.length > 1 && cTitle >= 0 && r[cTitle]) {
      const t = r[cTitle].toLowerCase();
      const byTitle = candidates.filter((e) => e.title.toLowerCase().includes(t) || t.includes(e.title.toLowerCase()));
      if (byTitle.length) candidates = byTitle;
    }
    if (candidates.length > 1 && cTime >= 0 && r[cTime]) {
      const t = r[cTime].toLowerCase().replace(/\s/g, '');
      const byTime = candidates.filter((e) => fmtTime(e.start).toLowerCase().replace(/\s/g, '').startsWith(t.replace(/:00/, '')) || fmtTime(e.start).toLowerCase().replace(/\s/g, '') === t);
      if (byTime.length) candidates = byTime;
    }
    const e = candidates[0];
    if (!e) { if (dk) skipped++; continue; }
    for (const [leg, c] of [['to', cTo], ['from', cFrom]]) {
      if (c < 0 || !r[c]) continue;
      const m = await findMember(r[c]);
      if (m) upserts.push({ carpool_id: cid, event_id: e.id, leg, driver_member_id: m.id, updated_by: state.session.user.id });
    }
  }
  const unique = [...new Map(upserts.map((u) => [`${u.event_id}|${u.leg}`, u])).values()];
  if (unique.length) must(await supabase.from('carpool_rides').upsert(unique, { onConflict: 'carpool_id,event_id,leg' }));
  await loadCarpools();
  return { rides: unique.length, added, skipped };
}

function carpoolCsv(cid) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Date', 'Time', 'Event', 'Location', 'Drop-off', 'Pick-up'].map(q).join(',')];
  for (const e of state.carpoolEvents || []) {
    lines.push([fmtDate(e.start), fmtTime(e.start), e.title, e.location, carpoolDriver(cid, e.id, 'to')?.name, carpoolDriver(cid, e.id, 'from')?.name].map(q).join(','));
  }
  return lines.join('\n');
}

function carpoolInviteLink(c) { return `${PUBLIC_URL}?carpool=${encodeURIComponent(c.invite_code)}`; }

// ---------------------------------------------------------------------------
// Game Day music: a pump-up mix for the drive. Families save their own playlist
// links; SIDLNE suggests clean songs and kids' SiriusXM channels.
// ---------------------------------------------------------------------------
const MUSIC_KEY = 'sidlne-music';
const MUSIC = {
  spotify: { name: 'Spotify', search: (q) => `https://open.spotify.com/search/${encodeURIComponent(q)}` },
  apple: { name: 'Apple Music', search: (q) => `https://music.apple.com/us/search?term=${encodeURIComponent(q)}` },
  siriusxm: { name: 'SiriusXM' },
};
const SERVICE_NAMES = { ...Object.fromEntries(Object.entries(MUSIC).map(([k, v]) => [k, v.name])), youtube: 'YouTube Music', amazon: 'Amazon Music', link: 'Link' };
const SXM_CHANNELS = [
  { name: 'KIDZ BOP Radio', channel: 135, about: 'Today’s pop hits sung by kids', url: 'https://www.siriusxm.com/kidzbopradio' },
  { name: 'Kids Place Live', channel: 134, about: 'Family-friendly music with live hosts', url: 'https://www.siriusxm.com/channels/kids-place-live' },
];
// Clean, kid-friendly pump-up songs
const GAME_DAY_SONGS = [
  ['We Will Rock You', 'Queen'], ['Eye of the Tiger', 'Survivor'], ['Hall of Fame', 'The Script, will.i.am'],
  ['Believer', 'Imagine Dragons'], ['Thunder', 'Imagine Dragons'], ['Centuries', 'Fall Out Boy'],
  ['Fight Song', 'Rachel Platten'], ['Roar', 'Katy Perry'], ['Unstoppable', 'Sia'],
  ['Stronger (What Doesn’t Kill You)', 'Kelly Clarkson'], ['Seven Nation Army', 'The White Stripes'], ['Uptown Funk', 'Mark Ronson, Bruno Mars'],
  ['Can’t Stop the Feeling!', 'Justin Timberlake'], ['Shake It Off', 'Taylor Swift'], ['Legend', 'The Score'],
  ['Born For This', 'The Score'], ['The Final Countdown', 'Europe'], ['Thunderstruck', 'AC/DC'],
  ['Titanium', 'David Guetta, Sia'], ['Good Feeling', 'Flo Rida'], ['On Top of the World', 'Imagine Dragons'],
  ['We Are the Champions', 'Queen'],
];

async function fetchPlaylists(hid) {
  const { data, error } = await supabase.from('game_day_playlists').select('*').eq('household_id', hid).order('created_at');
  if (error) { console.warn('Playlists unavailable:', error.message); return []; }
  return data || [];
}

function musicService() {
  let v = null;
  try { v = localStorage.getItem(MUSIC_KEY); } catch {}
  return MUSIC[v] ? v : 'spotify';
}

function detectService(url) {
  const host = (() => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
  if (/(^|\.)spotify\.(com|link)$|^spoti\.fi$/.test(host)) return 'spotify';
  if (/^(music|itunes|embed\.music)\.apple\.com$/.test(host)) return 'apple';
  if (/(^|\.)siriusxm\.(com|ca)$|^sxm\.app\.link$/.test(host)) return 'siriusxm';
  if (/^music\.youtube\.com$|(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return 'youtube';
  if (/^music\.amazon\./.test(host)) return 'amazon';
  return 'link';
}

// The family's saved mixes, this athlete's first
function playlistsFor(athleteId) {
  return [...state.playlists].sort((a, b) => (b.athlete_id === athleteId) - (a.athlete_id === athleteId));
}

function gameDayButton(athleteId = '', cls = 'outline') {
  return `<button class="${cls} gameday-btn" data-action="game-day" data-athlete="${esc(athleteId || '')}">🎧 Game Day mix</button>`;
}

function playLink(url, label, cls = 'outline') {
  return `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${label}</a>`;
}

function gameDayModal(athleteId = '') {
  const svc = musicService();
  const athlete = athleteId && byId(state.athletes, athleteId);
  const sport = athlete && state.teams.find((t) => t.athlete_id === athlete.id && t.sport)?.sport;
  const mixes = playlistsFor(athleteId);
  const eq = '<span class="eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
  const mine = mixes.map((p) => {
    const who = p.athlete_id ? byId(state.athletes, p.athlete_id)?.name : null;
    const service = SERVICE_NAMES[p.service] || 'Link';
    return `<div class="mix-card svc-${esc(p.service)}"><a class="mix-cover" href="${esc(p.url)}" target="_blank" rel="noopener" aria-label="Play ${esc(p.title)} on ${esc(service)}">
        <span class="mix-tags"><span class="mix-who">${esc(who ? `${who}’s mix` : 'Family mix')}</span><span class="mix-svc">${esc(service)}</span></span>
        <span class="mix-disc" aria-hidden="true"></span>
        <strong class="mix-title">${esc(p.title)}</strong>
        <span class="mix-play" aria-hidden="true">▶</span></a>
      <button class="mix-remove" data-action="delete-playlist" data-id="${p.id}" data-athlete="${esc(athleteId)}" aria-label="Remove ${esc(p.title)}">✕</button></div>`;
  }).join('');
  const addTile = `<button class="mix-card mix-add" data-action="add-playlist" data-athlete="${esc(athleteId)}"><span>＋</span><strong>${mixes.length ? 'Add a mix' : 'Add your first mix'}</strong><small>Spotify, Apple Music or SiriusXM</small></button>`;
  const picks = svc === 'siriusxm'
    ? `<h3>Kids’ channels on SiriusXM</h3><div class="chan-grid">${SXM_CHANNELS.map((c) => `<a class="chan-card" href="${esc(c.url)}" target="_blank" rel="noopener"><span class="chan-num">${c.channel}</span><span class="chan-text"><strong>${esc(c.name)}</strong><small>${esc(c.about)}</small></span><span class="mix-play" aria-hidden="true">▶</span></a>`).join('')}</div>
       <p class="hint">Want a specific channel? Open it in the SiriusXM app, tap Share, and add the link above.</p>`
    : `<div class="picks-head"><h3>SIDLNE pump-up picks</h3><span class="pill ok">CLEAN</span></div>
       <ol class="tracklist">${GAME_DAY_SONGS.map(([t, a], i) => `<li><a class="track" href="${esc(MUSIC[svc].search(`${t} ${a}`))}" target="_blank" rel="noopener"><span class="track-no">${String(i + 1).padStart(2, '0')}</span><span class="track-text"><strong>${esc(t)}</strong><small>${esc(a)}</small></span><i>▶</i></a></li>`).join('')}</ol>
       <div class="row-actions">${playLink(MUSIC[svc].search(`${sport ? sport + ' ' : ''}pump up clean`), `Find ${sport ? esc(sport.toLowerCase()) + ' ' : ''}pump-up playlists on ${MUSIC[svc].name}`)}<button class="link-btn" data-action="copy-songs">Copy song list</button></div>`;
  showModal(`<div class="gd-stage"><span class="eyebrow">GAME DAY${athlete ? ' · ' + esc(athlete.name.toUpperCase()) : ''}</span><h2>Game Day mix ${eq}</h2><p>Get the car fired up on the way to the game. Play to win!</p></div>
    <div class="segmented music-tabs">${Object.entries(MUSIC).map(([k, v]) => `<button class="${k === svc ? 'active' : ''}" data-action="music-service" data-service="${k}" data-athlete="${esc(athleteId)}">${v.name}</button>`).join('')}</div>
    <div class="section"><div class="section-head"><h3>Your family’s mixes</h3></div>
      <div class="mix-grid">${mine}${addTile}</div></div>
    <div class="section">${picks}</div>`);
}

function playlistForm(athleteId = '') {
  showModal(`<span class="eyebrow">GAME DAY</span><h2>Add a playlist</h2><p>In Spotify, Apple Music or SiriusXM, open the playlist or channel, tap <strong>Share → Copy link</strong>, and paste it here.</p>
    <form class="form" data-form="playlist" data-athlete="${esc(athleteId)}"><label>Link<input name="url" type="url" required maxlength="500" placeholder="https://open.spotify.com/playlist/…"></label>
    <label>Name<input name="title" required maxlength="80" placeholder="e.g. Hype Mix"></label>
    <label>Whose mix<select name="athlete_id"><option value="">The whole family</option>${state.athletes.map((a) => `<option value="${a.id}" ${a.id === athleteId ? 'selected' : ''}>${esc(a.name)}</option>`).join('')}</select></label>
    <button class="primary full" type="submit">Save playlist</button></form>`);
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
function chatHTML() {
  return `<div class="chat" style="grid-template-columns:minmax(0,1fr)"><div class="messages"><h2>${esc(state.household.name)}</h2><div class="message-list" id="messageList">${messagesHTML()}</div>
    <form class="compose" data-form="message"><input name="body" placeholder="Message your family…" aria-label="Message" maxlength="2000" autocomplete="off" required><button class="primary" type="submit">Send</button></form></div></div>`;
}

function visibleMessages() {
  return state.messages.filter((m) => !state.blocked.has(m.sender_id) && !state.reported.has(m.id));
}

function messagesHTML() {
  const me = state.session.user.id;
  const list = visibleMessages();
  if (!list.length) return '<div class="empty"><h3>No messages yet.</h3><p>Say hi to get the conversation started.</p></div>';
  return list.map((m) => {
    const name = memberName(m.sender_id);
    const when = new Date(m.inserted_at);
    const stamp = key(when) === key(new Date()) ? fmtTime(when) : `${fmtDate(when)} · ${fmtTime(when)}`;
    return `<div class="message ${m.sender_id === me ? 'mine' : ''}"><span class="avatar">${initials(name)}</span><div class="bubble"><small>${esc(name)} · ${esc(stamp)}<button class="msg-more" data-action="message-menu" data-id="${m.id}" aria-label="Message options: report, block or delete">⋯</button></small>${esc(m.body)}</div></div>`;
  }).join('');
}

// Chat safety: report a message, block a person, delete a message
async function loadChatSafety() {
  const me = state.session.user.id;
  const [blocked, reports] = await Promise.all([
    supabase.from('blocked_users').select('blocked_id').eq('blocker_id', me),
    supabase.from('message_reports').select('message_id').eq('reporter_id', me),
  ]);
  if (blocked.error || reports.error) console.warn('Chat safety unavailable:', (blocked.error || reports.error).message);
  state.blocked = new Set((blocked.data || []).map((b) => b.blocked_id));
  state.reported = new Set((reports.data || []).map((r) => r.message_id).filter(Boolean));
}

// A short list of slurs and obscenities that can't be posted in family chat
const BLOCKED_WORDS = ['fuck', 'shit', 'bitch', 'cunt', 'asshole', 'motherfucker', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'slut'];
function isObjectionable(text) {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/);
  return words.some((w) => BLOCKED_WORDS.some((b) => w === b || w === `${b}s` || w === `${b}ing` || w === `${b}ed`));
}

function messageMenuHTML(m) {
  const me = state.session.user.id;
  const mine = m.sender_id === me;
  const admin = ['owner', 'admin'].includes(state.role);
  const name = memberName(m.sender_id);
  return `<span class="eyebrow">MESSAGE</span><h2>${mine ? 'Your message' : `From ${esc(name)}`}</h2><p class="subtitle">${esc(m.body.length > 140 ? `${m.body.slice(0, 140)}…` : m.body)}</p>
    ${mine ? '' : `<form class="form" data-form="report"><input type="hidden" name="id" value="${m.id}"><label>Report this message<textarea name="reason" maxlength="500" placeholder="What’s wrong with it? (optional)"></textarea></label><small class="hint">Reports go to the SIDLNE team and are reviewed within 24 hours. The message is hidden for you right away.</small><button class="primary full" type="submit">Report message</button></form>`}
    <div class="row-actions">${!mine && m.sender_id ? `<button class="danger-btn" data-action="block-user" data-id="${m.sender_id}">Block ${esc(name)}</button>` : ''}${mine || admin ? `<button class="danger-btn" data-action="delete-message" data-id="${m.id}">Delete message</button>` : ''}</div>`;
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
// Game reminders (iPhone app only): a local notification 1 hour before events
// ---------------------------------------------------------------------------
const REMINDERS_KEY = 'sidlne-reminders';
const REMINDER_LEAD_MS = 60 * 60 * 1000;
const MAX_REMINDERS = 60; // iOS keeps at most 64 pending local notifications

function remindersOn() {
  try { return localStorage.getItem(REMINDERS_KEY) === '1'; } catch { return false; }
}

// Stable 31-bit id per event so rescheduling replaces rather than duplicates
function reminderId(eventId) {
  let h = 0;
  for (const c of String(eventId)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h) || 1;
}

async function scheduleReminders() {
  const LN = Plugins.LocalNotifications;
  if (!NATIVE || !LN || !remindersOn()) return;
  try {
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    const now = Date.now();
    const soon = state.events
      .filter((e) => { const at = new Date(e.start).getTime() - REMINDER_LEAD_MS; return at > now && at < now + 14 * DAY; })
      .slice(0, MAX_REMINDERS);
    if (!soon.length) return;
    await LN.schedule({
      notifications: soon.map((e) => {
        const who = athleteOf(e)?.name;
        return {
          id: reminderId(e.id),
          title: `${who ? who + ': ' : ''}${e.title} in 1 hour`,
          body: [fmtTime(e.start), e.location].filter(Boolean).join(' · '),
          schedule: { at: new Date(new Date(e.start).getTime() - REMINDER_LEAD_MS) },
          extra: { eventId: e.id },
        };
      }),
    });
  } catch (err) { console.error('Could not schedule reminders', err); }
}

async function setReminders(on) {
  const LN = Plugins.LocalNotifications;
  if (!LN) return;
  if (on) {
    const perm = await LN.requestPermissions();
    if (perm.display !== 'granted') { toast('Turn on notifications for SIDLNE in iPhone Settings first.'); return; }
    try { localStorage.setItem(REMINDERS_KEY, '1'); } catch {}
    await scheduleReminders();
    toast('Reminders on: you’ll get a heads-up 1 hour before each event');
  } else {
    try { localStorage.removeItem(REMINDERS_KEY); } catch {}
    const pending = await LN.getPending();
    if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
    toast('Reminders off');
  }
  renderMain();
}

if (NATIVE && Plugins.LocalNotifications) {
  // Tapping a reminder opens that event
  Plugins.LocalNotifications.addListener('localNotificationActionPerformed', ({ notification }) => {
    const id = notification?.extra?.eventId;
    if (id && state.household) { go('Calendar'); openEvent(id); }
  });
}

// ---------------------------------------------------------------------------
// Push notifications (iPhone app only): schedule changes reach every parent's
// phone, even when the app is closed. The server sends them; the app only
// asks permission and registers the phone.
// ---------------------------------------------------------------------------
const PUSH_TOKEN_KEY = 'sidlne-push-token';
let pushListening = false;
state.pushStatus = null; // 'granted' | 'denied' | 'prompt'

async function setupPush({ ask = true } = {}) {
  const PN = Plugins.PushNotifications;
  if (!NATIVE || !PN || !state.session) return;
  try {
    if (!pushListening) {
      pushListening = true;
      PN.addListener('registration', async ({ value }) => {
        try {
          must(await supabase.rpc('register_push_device', { device_token: value, device_platform: 'ios', device_time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone || null }));
          localStorage.setItem(PUSH_TOKEN_KEY, value);
        } catch (err) { console.error('Could not register for notifications', err); }
      });
      PN.addListener('registrationError', (err) => console.error('Push registration failed', err));
      // Tapping a notification opens the changed event (or the overview with the alerts)
      PN.addListener('pushNotificationActionPerformed', ({ notification }) => openFromPush(notification?.data?.sidlne));
    }
    let perm = await PN.checkPermissions();
    if (perm.receive === 'prompt' && ask) perm = await PN.requestPermissions();
    state.pushStatus = perm.receive;
    if (perm.receive === 'granted') await PN.register();
  } catch (err) { console.error('Push setup failed', err); }
}

async function openFromPush(info) {
  if (!info || !state.session) return;
  try {
    if (info.household_id && state.household?.id !== info.household_id && state.memberships.some((m) => m.household_id === info.household_id)) {
      await selectHousehold(info.household_id);
      renderApp();
    }
    if (info.event_id && state.events.some((e) => e.id === info.event_id)) { go('Calendar'); openEvent(info.event_id); }
    else go('Overview');
  } catch (err) { console.error(err); }
}

async function turnOnPush() {
  await setupPush();
  if (state.pushStatus === 'granted') toast('Notifications on: schedule changes will come to this phone');
  else toast('Turn on notifications for SIDLNE in iPhone Settings > Notifications.');
  renderMain();
}

// Stop sending this account's notifications to this phone
async function forgetPushDevice() {
  let token = null;
  try { token = localStorage.getItem(PUSH_TOKEN_KEY); localStorage.removeItem(PUSH_TOKEN_KEY); } catch {}
  if (token) { try { await supabase.rpc('unregister_push_device', { device_token: token }); } catch {} }
}

// ---------------------------------------------------------------------------
// Siri (iPhone app only): a summary of the next two weeks, saved on the phone
// for the Siri shortcuts in ios/App/App/SiriShortcuts.swift to read.
// ---------------------------------------------------------------------------
const SIRI_KEY = 'sidlne-siri';
let siriTimer = null, siriLast = '';

function saveSiriSnapshot() {
  const Prefs = Plugins.Preferences;
  if (!NATIVE || !Prefs || !state.household) return;
  clearTimeout(siriTimer);
  siriTimer = setTimeout(async () => {
    try {
      const svc = musicService();
      const fallbackMix = svc === 'siriusxm' ? SXM_CHANNELS[0].url : MUSIC[svc].search('pump up clean');
      // Every athlete's events, whatever filter is on screen
      const now = Date.now();
      const soon = state.events
        .filter((e) => new Date(e.end || e.start).getTime() > now && new Date(e.start).getTime() < now + 14 * DAY)
        .sort((x, y) => new Date(x.start) - new Date(y.start));
      const events = soon.slice(0, 25).map((e) => {
        const ride = rideFor(e.id);
        const c = state.carpools.find((x) => x.team_id === e.team_id && ownsCarpool(x));
        const carpoolTo = c && carpoolDriver(c.id, e.id, 'to');
        return {
          title: e.title,
          start: new Date(e.start).toISOString(),
          athlete: athleteOf(e)?.name || null,
          location: e.location || null,
          driver: ride?.driver_profile_id ? memberName(ride.driver_profile_id) : carpoolTo?.name || null,
          directionsUrl: e.location ? wazeUrl(e.location) : null,
          mixUrl: playlistsFor(e.athlete_id)[0]?.url || null,
        };
      });
      const value = JSON.stringify({ events, mixUrl: state.playlists[0]?.url || fallbackMix });
      if (value === siriLast) return;
      siriLast = value;
      await Prefs.set({ key: SIRI_KEY, value });
    } catch (err) { console.error('Could not update Siri', err); }
  }, 500);
}

async function clearSiriSnapshot() {
  siriLast = '';
  try { await Plugins.Preferences?.remove({ key: SIRI_KEY }); } catch {}
}

// ---------------------------------------------------------------------------
// Family settings
// ---------------------------------------------------------------------------
function inviteLink() {
  return `${PUBLIC_URL}?join=${encodeURIComponent(state.household.invite_code)}`;
}

function familyHTML() {
  const admin = ['owner', 'admin'].includes(state.role);
  const me = state.session.user.id;
  const others = state.memberships.filter((m) => m.household_id !== state.household.id);
  const crew = state.members.length;
  return `${heroCard({ eyebrow: `${String(state.household.name || "").toUpperCase()} · ${crew} ${crew === 1 ? 'MEMBER' : 'MEMBERS'}`, title: crew > 1 ? 'Bigger crew.<br>Fewer texts.' : 'Don’t do this<br>alone.', text: crew > 1 ? 'Everyone sees the same schedule, rides and chat.' : 'Invite a co-parent, grandparent or carpool partner below. They see the same schedule, rides and chat.', ghost: 'CREW' })}<div class="main-grid"><div>
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
    ${NATIVE && Plugins.Preferences ? `<div class="rail-card siri-card"><h2>Hey Siri</h2><p>Ask Siri, hands-free in the car:</p><ul class="siri-list"><li>“What’s next on SIDLNE?”</li><li>“Who’s driving on SIDLNE?”</li><li>“What’s on this week in SIDLNE?”</li><li>“Play the Game Day mix on SIDLNE”</li><li>“Take me to the game with SIDLNE”</li></ul><p class="hint">They also appear in the Shortcuts app, so you can add them to CarPlay or your Home Screen.</p></div>` : ''}
    ${NATIVE && Plugins.PushNotifications ? `<div class="rail-card"><h2>Schedule-change alerts</h2><p>${state.pushStatus === 'granted' ? 'On. This phone gets a notification when a game or practice moves, changes fields, is cancelled or is added.' : 'Get a notification on this phone when a game or practice moves, changes fields, is cancelled or is added.'}</p>${state.pushStatus === 'granted' ? '<span class="pill ok">NOTIFICATIONS ON</span>' : '<button class="primary" data-action="enable-push">🔔 Turn on notifications</button>'}</div>` : ''}
    ${NATIVE && Plugins.LocalNotifications ? `<div class="rail-card"><h2>Game reminders</h2><p>Get a notification 1 hour before every practice and game on this phone.</p><button class="${remindersOn() ? 'outline' : 'primary'}" data-action="toggle-reminders">${remindersOn() ? 'Turn off reminders' : '🔔 Turn on reminders'}</button></div>` : ''}
    ${state.blocked.size ? `<div class="rail-card"><h2>Blocked</h2><p>You don’t see messages from these people.</p>${[...state.blocked].map((id) => `<div class="list-row"><span class="grow"><strong>${esc(memberName(id))}</strong></span><button class="outline" data-action="unblock-user" data-id="${id}">Unblock</button></div>`).join('')}</div>` : ''}
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
  'sign-out': async () => { if (state.channel) supabase.removeChannel(state.channel); await forgetPushDevice(); await clearSiriSnapshot(); await supabase.auth.signOut(); state.session = null; renderAuth(); },
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
  'open-carpool': (el) => busy(null, () => openCarpool(el.dataset.id)),
  'close-carpool': () => closeCarpool(),
  'new-carpool': () => carpoolForm(),
  'join-carpool': () => carpoolJoinForm(),
  'carpool-me': (el) => carpoolMeForm(el.dataset.id),
  'carpool-add-parent': (el) => carpoolAddParentForm(el.dataset.id),
  'carpool-import': (el) => carpoolImportForm(el.dataset.id),
  'share-carpool': async (el) => {
    const c = state.carpools.find((x) => x.id === el.dataset.id);
    const url = carpoolInviteLink(c);
    const text = `Join our "${c.name}" carpool on SIDLNE to see the schedule and sign up to drive. Code: ${c.invite_code}`;
    if (Plugins.Share) { try { await Plugins.Share.share({ title: 'Join our carpool', text, url, dialogTitle: 'Invite parents' }); } catch {} return; }
    if (navigator.share) { try { await navigator.share({ title: 'Join our carpool', text, url }); } catch {} } else copyText(url);
  },
  'carpool-autofill': (el) => busy(null, async () => {
    const plan = planAutofill(el.dataset.id);
    if (!plan.length) { toast(state.carpoolMembers.some((m) => m.carpool_id === el.dataset.id) ? 'Every drive already has a driver' : 'Add drivers first'); return; }
    must(await supabase.from('carpool_rides').upsert(plan, { onConflict: 'carpool_id,event_id,leg' }));
    await loadCarpools();
    toast(`Assigned ${plan.length} ${plan.length === 1 ? 'drive' : 'drives'}`);
    renderMain();
  }),
  'carpool-export': async (el) => {
    const c = state.carpools.find((x) => x.id === el.dataset.id);
    const csv = carpoolCsv(c.id);
    if (Plugins.Share) { try { await Plugins.Share.share({ title: `${c.name} schedule`, text: csv, dialogTitle: 'Export carpool' }); } catch {} return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${c.name.replace(/[^\w -]+/g, '').trim() || 'carpool'}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Downloaded. Open it with Google Sheets: File → Import.');
  },
  'edit-carpool': (el) => carpoolEditForm(el.dataset.id),
  'delete-carpool': async (el) => {
    if (!confirm('Delete this carpool for everyone?')) return;
    await busy(null, async () => { must(await supabase.from('carpools').delete().eq('id', el.dataset.id)); await loadCarpools(); closeCarpool(); toast('Carpool deleted'); });
  },
  'leave-carpool': async (el) => {
    if (!confirm('Leave this carpool? Your drives will be unassigned.')) return;
    await busy(null, async () => { must(await supabase.from('carpool_members').delete().eq('carpool_id', el.dataset.id).eq('profile_id', state.session.user.id)); await loadCarpools(); closeCarpool(); toast('You left the carpool'); });
  },
  'seen-changes': () => { try { localStorage.setItem(changesSeenKey(), state.changes[0]?.created_at || new Date().toISOString()); } catch {} state.allChanges = false; renderMain(); },
  'all-changes': () => { state.allChanges = true; renderMain(); },
  'rsvp': (el) => busy(null, async () => { await setRsvp(el.dataset.event, el.dataset.athlete, el.dataset.status); if (!document.getElementById('modalBg').classList.contains('hidden')) openEvent(el.dataset.event); }),
  'claim-ride': (el) => busy(null, async () => { await claimRide(el.dataset.id, true); if (!document.getElementById('modalBg').classList.contains('hidden')) openEvent(el.dataset.id); }),
  'release-ride': (el) => busy(null, async () => { await claimRide(el.dataset.id, false); if (!document.getElementById('modalBg').classList.contains('hidden')) openEvent(el.dataset.id); }),
  'add-athlete': () => athleteForm(),
  'edit-athlete': (el) => athleteForm(byId(state.athletes, el.dataset.id)),
  'delete-athlete': async (el) => {
    if (!confirm('Remove this athlete? Their events stay on the calendar.')) return;
    await busy(null, async () => { must(await supabase.from('athletes').delete().eq('id', el.dataset.id)); if (state.filter === el.dataset.id) state.filter = 'all'; await reload('athletes', 'teams', 'events'); closeModal(); renderApp(); });
  },
  'add-team': () => teamForm(),
  'sort-calendar': (el) => sortCalendar(el.dataset.id),
  'add-from-link': (el) => teamForm(null, byId(state.teams, el.dataset.id)?.calendar_url),
  'sync-link': async (el) => {
    el.disabled = true; el.textContent = 'Syncing…';
    await busy(null, async () => { for (const t of linkTeams(el.dataset.id)) await syncTeam(t.id, true); toast('Calendar synced'); });
    if (el.isConnected) { el.disabled = false; el.textContent = 'Sync now'; }
  },
  'edit-team': (el) => teamForm(byId(state.teams, el.dataset.id)),
  'delete-team': async (el) => {
    if (!confirm('Delete this team? Events imported from its calendar are deleted too.')) return;
    await busy(null, async () => { must(await supabase.from('teams').delete().eq('id', el.dataset.id)); await reload('teams', 'events', 'rides'); closeModal(); renderMain(); toast('Team deleted'); });
  },
  'sync-team': async (el) => { el.disabled = true; el.textContent = 'Syncing…'; await busy(null, () => syncTeam(el.dataset.id)); if (el.isConnected) { el.disabled = false; el.textContent = 'Sync now'; } },
  invite: () => go('Family'),
  'toggle-reminders': () => busy(null, () => setReminders(!remindersOn())),
  'enable-push': () => busy(null, turnOnPush),
  'game-day': (el) => gameDayModal(el.dataset.athlete),
  'music-service': (el) => { try { localStorage.setItem(MUSIC_KEY, el.dataset.service); } catch {} gameDayModal(el.dataset.athlete); },
  'add-playlist': (el) => playlistForm(el.dataset.athlete),
  'delete-playlist': async (el) => {
    if (!confirm('Remove this playlist for everyone in your family?')) return;
    await busy(null, async () => { must(await supabase.from('game_day_playlists').delete().eq('id', el.dataset.id)); state.playlists = await fetchPlaylists(state.household.id); gameDayModal(el.dataset.athlete); });
  },
  'copy-songs': () => copyText(GAME_DAY_SONGS.map(([t, a]) => `${t} – ${a}`).join('\n')),
  'share-invite': async () => {
    const url = inviteLink();
    const text = `Join ${state.household.name} on SIDLNE. Invite code: ${state.household.invite_code}`;
    if (Plugins.Share) { try { await Plugins.Share.share({ title: 'Join our family on SIDLNE', text, url, dialogTitle: 'Invite to SIDLNE' }); } catch {} return; }
    if (navigator.share) { try { await navigator.share({ title: 'Join our family on SIDLNE', text: `Join ${state.household.name} on SIDLNE. Invite code: ${state.household.invite_code}`, url }); } catch {} }
    else copyText(url);
  },
  'copy-invite': () => copyText(inviteLink()),
  'rotate-code': async () => {
    if (!confirm('Reset the invite code? The old code and link will stop working.')) return;
    await busy(null, async () => { state.household.invite_code = must(await supabase.rpc('rotate_invite_code', { hid: state.household.id })); renderMain(); toast('New invite code ready'); });
  },
  'message-menu': (el) => { const m = byId(state.messages, el.dataset.id); if (m) showModal(messageMenuHTML(m)); },
  'block-user': async (el) => {
    if (!confirm(`Block ${memberName(el.dataset.id)}? You won’t see their messages. You can unblock them under Family.`)) return;
    await busy(null, async () => {
      must(await supabase.from('blocked_users').upsert({ blocker_id: state.session.user.id, blocked_id: el.dataset.id }));
      state.blocked.add(el.dataset.id);
      closeModal(); renderMessages(); toast('Blocked. You won’t see their messages.');
    });
  },
  'unblock-user': (el) => busy(null, async () => {
    must(await supabase.from('blocked_users').delete().eq('blocker_id', state.session.user.id).eq('blocked_id', el.dataset.id));
    state.blocked.delete(el.dataset.id);
    renderMain(); toast('Unblocked');
  }),
  'delete-message': async (el) => {
    if (!confirm('Delete this message for everyone?')) return;
    await busy(null, async () => { must(await supabase.from('messages').delete().eq('id', el.dataset.id)); await reload('messages'); closeModal(); renderMessages(); toast('Message deleted'); });
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
    await busy(null, async () => { must(await supabase.rpc('delete_my_account')); await clearSiriSnapshot(); await supabase.auth.signOut(); state.session = null; renderAuth(); toast('Your account was deleted'); });
  },
};

const forms = {
  playlist: async (f, form) => {
    const url = f.get('url').trim();
    if (!/^https:\/\//i.test(url)) throw new Error('Paste the full link, starting with https://');
    const athleteId = f.get('athlete_id') || null;
    must(await supabase.from('game_day_playlists').insert({ household_id: state.household.id, athlete_id: athleteId, title: f.get('title').trim(), url, service: detectService(url), created_by: state.session.user.id }));
    state.playlists = await fetchPlaylists(state.household.id);
    gameDayModal(form.dataset.athlete || athleteId || '');
    toast('Playlist saved');
  },
  carpool: async (f) => {
    const team = byId(state.teams, f.get('team_id'));
    const c = must(await supabase.from('carpools').insert({ household_id: state.household.id, team_id: team.id, name: f.get('name').trim() || `${team.name} carpool`, event_filter: (f.get('event_filter') || '').trim() || null, created_by: state.session.user.id }).select().single());
    must(await supabase.from('carpool_members').insert({ carpool_id: c.id, profile_id: state.session.user.id, name: state.profile?.display_name || state.session.user.email.split('@')[0] }));
    await loadCarpools();
    closeModal();
    await openCarpool(c.id);
    // Optional Google Sheet: the carpool exists either way, so a sheet problem doesn't lose it
    let sheet = '';
    try { sheet = await readSheetInput(f); } catch (err) { toast(`Carpool created, but the sheet couldn’t be read: ${err.message}`); return; }
    if (sheet) {
      const r = await importCarpoolSheet(c.id, sheet);
      renderMain();
      toast(`Carpool created. ${importToast(r)}`);
    } else toast('Carpool created. Invite the other parents!');
  },
  'carpool-edit': async (f, form) => {
    const cid = form.dataset.id;
    must(await supabase.from('carpools').update({ name: f.get('name').trim(), event_filter: f.get('event_filter').trim() || null }).eq('id', cid));
    await loadCarpools();
    closeModal();
    await openCarpool(cid);
    toast('Carpool updated');
  },
  'carpool-me': async (f, form) => {
    const cid = form.dataset.id;
    const values = { name: f.get('name').trim(), phone: f.get('phone').trim() || null, seats: f.get('seats') === '' ? null : +f.get('seats') };
    const m = myCarpoolMember(cid);
    if (m) must(await supabase.from('carpool_members').update(values).eq('id', m.id));
    else must(await supabase.rpc('join_carpool', { code: state.carpools.find((c) => c.id === cid).invite_code, member_name: values.name, member_phone: values.phone, member_seats: values.seats }));
    await loadCarpools();
    closeModal();
    renderMain();
  },
  'carpool-parent': async (f, form) => {
    must(await supabase.from('carpool_members').insert({ carpool_id: form.dataset.id, name: f.get('name').trim(), phone: f.get('phone').trim() || null }));
    await loadCarpools();
    closeModal();
    renderMain();
  },
  'join-carpool': async (f) => {
    const seats = f.get('seats');
    const c = must(await supabase.rpc('join_carpool', { code: f.get('code').trim(), member_name: f.get('name').trim(), member_phone: f.get('phone').trim() || null, member_seats: seats === '' ? null : +seats }));
    await loadCarpools();
    closeModal();
    await openCarpool(c.id);
    toast(`You joined ${c.name}`);
  },
  'carpool-import': async (f, form) => {
    const text = await readSheetInput(f);
    if (!text) throw new Error('Paste a Google Sheets link or choose a file.');
    const r = await importCarpoolSheet(form.dataset.id, text);
    closeModal();
    renderMain();
    toast(importToast(r));
  },
  signin: async (f) => {
    must(await supabase.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') }));
    state.session = (await supabase.auth.getSession()).data.session;
    await enter();
  },
  signup: async (f, form) => {
    const res = must(await supabase.auth.signUp({ email: f.get('email').trim(), password: f.get('password'), options: { data: { display_name: f.get('name').trim() }, emailRedirectTo: PUBLIC_URL } }));
    if (res.session) { state.session = res.session; await enter(); }
    else form.outerHTML = '<div class="success"><strong>Check your email.</strong> Tap the confirmation link we sent, then come back and sign in.</div>';
  },
  forgot: async (f, form) => {
    must(await supabase.auth.resetPasswordForEmail(f.get('email').trim(), { redirectTo: PUBLIC_URL }));
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
    // A calendar link another team already has: sort its events between them
    // instead of importing every event twice
    const twin = values.calendar_url && state.teams.some((t) => t.id !== id && linkKey(t.calendar_url) === linkKey(values.calendar_url));
    const team = id
      ? must(await supabase.from('teams').update(values).eq('id', id).select().single())
      : must(await supabase.from('teams').insert({ ...values, household_id: state.household.id }).select().single());
    if (values.athlete_id !== (existing?.athlete_id ?? null) && existing) {
      must(await supabase.from('events').update({ athlete_id: values.athlete_id }).eq('team_id', team.id));
    }
    await reload('teams', 'events');
    closeModal();
    renderMain();
    if (twin && team.calendar_url !== existing?.calendar_url) {
      await sortCalendar(team.id);
      return;
    }
    if (team.calendar_url && team.calendar_url !== existing?.calendar_url) {
      toast('Importing team calendar…');
      try { await syncTeam(team.id); } catch (err) { toast(`Calendar import failed: ${friendlyError(err)}`); }
    }
  },
  sort: async (f) => {
    const { teamId, names } = state.sorting;
    const teams = linkTeams(teamId);
    const picks = names.map((n, i) => [n.pattern, f.get(`n${i}`) || '']);
    const hidden = picks.filter(([, v]) => v === 'hide').map(([p]) => p);
    for (const t of teams) {
      // A lone team that takes everything stays that way; only hidden names are saved
      const titles = teams.length > 1 ? picks.filter(([, v]) => v === t.id).map(([p]) => p) : [];
      const words = (f.get(`w${t.id}`) || '').trim() || null;
      must(await supabase.from('teams').update({ event_titles: titles, hidden_titles: hidden, event_filter: words, unsorted_titles: [] }).eq('id', t.id));
    }
    closeModal();
    toast('Sorting your calendar…');
    for (const t of teams) await syncTeam(t.id, true);
    toast('Sorted. Every kid’s calendar is up to date.');
  },
  event: async (f, form) => {
    const date = f.get('date');
    const start = new Date(`${date}T${f.get('start')}`);
    let end = f.get('end') ? new Date(`${date}T${f.get('end')}`) : null;
    if (end && end < start) end = new Date(+end + DAY); // ends after midnight
    const id = form.dataset.id;
    const original = id ? byId(state.events, id) : null;
    // An event from a team calendar stays with its team, so the next sync
    // keeps updating it instead of adding a second copy
    const team = original?.source === 'ical' && original.team_id ? byId(state.teams, original.team_id) || { id: original.team_id } : byId(state.teams, f.get('team_id'));
    const values = {
      title: f.get('title').trim(),
      athlete_id: f.get('athlete_id') || team?.athlete_id || null,
      team_id: team?.id || null,
      start: start.toISOString(),
      end: end ? end.toISOString() : null,
      location: f.get('location').trim() || null,
      description: f.get('description').trim() || null,
    };
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
    if (isObjectionable(body)) { toast('That message has language that isn’t allowed in family chat.'); return; }
    form.reset();
    must(await supabase.from('messages').insert({ household_id: state.household.id, sender_id: state.session.user.id, body }));
    await reload('messages');
    renderMessages();
    form.querySelector('input').focus();
  },
  report: async (f) => {
    const m = byId(state.messages, f.get('id'));
    if (!m) return;
    must(await supabase.from('message_reports').insert({ message_id: m.id, household_id: state.household.id, reporter_id: state.session.user.id, sender_id: m.sender_id, body: m.body, reason: f.get('reason').trim() || null }));
    state.reported.add(m.id);
    closeModal(); renderMessages(); toast('Thanks. The SIDLNE team will review it within 24 hours.');
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

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change="carpool-ride"]');
  if (!el) return;
  busy(null, async () => { await setCarpoolRide(el.dataset.carpool, el.dataset.event, el.dataset.leg, el.value || null); renderMain(); });
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
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') autoSync(); });
setInterval(autoSync, RETRY_MS);
window.addEventListener('offline', () => { toast('You’re offline. Changes will fail until you reconnect.'); });

if (!NATIVE && 'serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(() => {}));

boot();
