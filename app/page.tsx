"use client";

import { useMemo, useState } from "react";

type Athlete = "Avery" | "Jordan";
type ViewMode = "week" | "month";
type NavTab = "Overview" | "Calendar" | "Teams" | "Rides" | "Chat" | "Apps";

type EventItem = {
  id: string;
  title: string;
  athlete: Athlete;
  sport: string;
  team: string;
  location: string;
  start: string;
  end: string;
  source: string;
};

const navItems: NavTab[] = ["Overview", "Calendar", "Teams", "Rides", "Chat", "Apps"];
const athletes: Array<"Everyone" | Athlete> = ["Everyone", "Avery", "Jordan"];

const initialEvents: EventItem[] = [
  { id: "1", title: "Lacrosse practice", athlete: "Avery", sport: "Lacrosse", team: "Northside Lacrosse", location: "Community Field", start: isoFromOffset(0, 17, 30), end: isoFromOffset(0, 19, 0), source: "SportsEngine" },
  { id: "2", title: "Basketball game", athlete: "Jordan", sport: "Basketball", team: "Town Hoops", location: "Middle School Gym", start: isoFromOffset(1, 18, 0), end: isoFromOffset(1, 19, 15), source: "TeamSnap" },
  { id: "3", title: "Skills & drills", athlete: "Avery", sport: "Lacrosse", team: "Velocity Lacrosse", location: "Riverfront Park", start: isoFromOffset(2, 10, 0), end: isoFromOffset(2, 11, 30), source: "LeagueApps" },
  { id: "4", title: "Flag football practice", athlete: "Jordan", sport: "Football", team: "Wildcats Flag", location: "Town Turf", start: isoFromOffset(2, 10, 30), end: isoFromOffset(2, 12, 0), source: "Sports Connect" },
  { id: "5", title: "Game vs. Tigers", athlete: "Avery", sport: "Lacrosse", team: "Northside Lacrosse", location: "Riverside Athletic Complex", start: isoFromOffset(4, 13, 0), end: isoFromOffset(4, 14, 30), source: "SportsEngine" },
  { id: "6", title: "Team picture day", athlete: "Jordan", sport: "Football", team: "Wildcats Flag", location: "Town Turf", start: isoFromOffset(6, 9, 0), end: isoFromOffset(6, 10, 0), source: "Sports Connect" },
  { id: "7", title: "Tournament", athlete: "Avery", sport: "Lacrosse", team: "Velocity Lacrosse", location: "Regional Sports Center", start: isoFromOffset(9, 8, 0), end: isoFromOffset(9, 15, 0), source: "Crossbar" },
  { id: "8", title: "Basketball practice", athlete: "Jordan", sport: "Basketball", team: "Town Hoops", location: "Community Center", start: isoFromOffset(12, 17, 0), end: isoFromOffset(12, 18, 15), source: "TeamSnap" },
];

const icons: Record<NavTab, string> = {
  Overview: "▣",
  Calendar: "🗓",
  Teams: "👥",
  Rides: "🚐",
  Chat: "💬",
  Apps: "⚙",
};

function isoFromOffset(offsetDays: number, hour: number, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function formatKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDateFromKey(key: string) {
  return new Date(`${key}T12:00:00`);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(new Date(value));
}

function clampDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<NavTab>("Overview");
  const [view, setView] = useState<ViewMode>("week");
  const [filter, setFilter] = useState<"Everyone" | Athlete>("Everyone");
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState<EventItem[]>(initialEvents);
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");

  const filteredEvents = useMemo(() => {
    return [...events]
      .filter((event) => filter === "Everyone" || event.athlete === filter)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [events, filter]);

  const upNext = useMemo(() => {
    const now = Date.now();
    return filteredEvents.find((event) => new Date(event.end).getTime() > now) ?? filteredEvents[0];
  }, [filteredEvents]);

  const nextSevenDays = useMemo(() => {
    const now = Date.now();
    const future = now + 7 * 24 * 60 * 60 * 1000;
    return filteredEvents.filter((event) => {
      const start = new Date(event.start).getTime();
      return start >= now && start <= future;
    }).length;
  }, [filteredEvents]);

  const daysInWeek = useMemo(() => {
    const start = new Date(selectedDate);
    start.setHours(12, 0, 0, 0);
    const sunday = new Date(start);
    sunday.setDate(start.getDate() - start.getDay());

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + index);
      return date;
    });
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const cursor = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const leading = new Date(cursor);
    leading.setDate(1 - cursor.getDay());

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(leading);
      date.setDate(leading.getDate() + index);
      return date;
    });
  }, [selectedDate]);

  const selectedDayEvents = useMemo(() => {
    return filteredEvents.filter((event) => formatKey(new Date(event.start)) === formatKey(selectedDate));
  }, [filteredEvents, selectedDate]);

  const iconForAthlete = (athlete: Athlete) => (athlete === "Jordan" ? "j" : "a");

  const addEvent = () => {
    const title = (document.getElementById("event-title") as HTMLInputElement)?.value?.trim();
    const sport = (document.getElementById("event-sport") as HTMLInputElement)?.value?.trim();
    const location = (document.getElementById("event-location") as HTMLInputElement)?.value?.trim();
    const athlete = (document.getElementById("event-athlete") as HTMLSelectElement)?.value as Athlete;
    const when = (document.getElementById("event-date") as HTMLInputElement)?.value;

    if (!title || !sport || !location || !when) return;

    const start = new Date(when);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const newEvent: EventItem = {
      id: `local-${Date.now()}`,
      title,
      athlete,
      sport,
      team: athlete === "Avery" ? "Demo Family" : "Demo Team",
      location,
      start: start.toISOString(),
      end: end.toISOString(),
      source: "Manual input",
    };

    setEvents((current) => [...current, newEvent]);
    setSelectedDate(start);
    setFilter("Everyone");
    setModalOpen(false);
    setActiveTab("Calendar");
  };

  const tabTitles: Record<NavTab, { title: string; subtitle: string }> = {
    Overview: { title: "All your sports. Zero chaos.", subtitle: "Try the family sports calendar with sample events." },
    Calendar: { title: "The whole game plan.", subtitle: "Switch between week and month views." },
    Teams: { title: "One crew. Many teams.", subtitle: "Every team in one simple view." },
    Rides: { title: "Who’s got the ride?", subtitle: "Keep driver plans with the event." },
    Chat: { title: "Keep the crew in the loop.", subtitle: "Try family chat with local demo messages." },
    Apps: { title: "Bring it all together.", subtitle: "See how sports calendars connect." },
  };

  return (
    <>
      <div className="app-shell">
        <aside className="sidebar">
          <div className="brand-row">
            <div className="brand">SIDLNE<span className="brand-slash">/</span></div>
            <span className="badge">PUBLIC DEMO</span>
          </div>

          <div className="workspace-card">
            <div className="workspace-icon">D</div>
            <div>
              <strong>Demo Family</strong>
              <small>Sample schedule only</small>
            </div>
          </div>

          <div className="nav-heading">TRY THE APP</div>
          <nav className="nav-list">
            {navItems.map((tab) => (
              <button
                key={tab}
                className={tab === activeTab ? "nav-item active" : "nav-item"}
                onClick={() => setActiveTab(tab)}
              >
                <span className="nav-icon">{icons[tab]}</span>
                <span>{tab}</span>
              </button>
            ))}
          </nav>

          <div className="privacy-box">
            <strong>✓ Privacy-safe demo</strong>
            No password, personal calendars, names, links or messages.
          </div>
        </aside>

        <div className="main-pane">
          <header className="topbar">
            <div className="crumb">SIDLNE Demo <span>/</span> {activeTab}</div>
            <div className="top-actions">
              <div className="live-pill"><span className="dot" /> Ready to test</div>
              <div className="avatar">DF</div>
            </div>
          </header>

          <main className="content">
            <section className="page-header">
              <div>
                <div className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</div>
                <h1>{tabTitles[activeTab].title}</h1>
                <p>{tabTitles[activeTab].subtitle}</p>
              </div>
              <button className="primary-button" onClick={() => setModalOpen(true)}>＋ Add event</button>
            </section>

            {activeTab === "Overview" && (
              <>
                <div className="notice-box">✓ <strong>This is a public demo.</strong> Everything is sample data, and anything you add stays on this device.</div>

                <div className="overview-grid">
                  <div className="hero-card">
                    <span className="eyebrow lime">UP NEXT</span>
                    <h2>{upNext ? upNext.title : "Your next play starts here."}</h2>
                    <p>{upNext ? `◷ ${formatLongDate(upNext.start)} · ${formatTime(upNext.start)}` : "Add a sample event."}</p>
                    <p>{upNext ? `⌖ ${upNext.location}` : ""}</p>
                    <div className="hero-mark">S/</div>
                  </div>

                  <div className="stat-card">
                    <span className="eyebrow">NEXT 7 DAYS</span>
                    <strong>{nextSevenDays}</strong>
                    <p>events in the lineup</p>
                    <small>2 athletes · 4 teams</small>
                  </div>
                </div>

                <div className="dashboard-grid">
                  <div className="calendar-panel">
                    <div className="panel-header">
                      <h3>Your lineup</h3>
                      <div className="toolbar">
                        <div className="segmented">
                          <button className={view === "week" ? "active" : ""} onClick={() => setView("week")}>Week</button>
                          <button className={view === "month" ? "active" : ""} onClick={() => setView("month")}>Month</button>
                        </div>
                        <button className="ghost-button" onClick={() => setSelectedDate(new Date())}>Today</button>
                      </div>
                    </div>

                    <div className="filters-row">
                      {athletes.map((athlete) => (
                        <button
                          key={athlete}
                          className={filter === athlete ? "filter active" : "filter"}
                          onClick={() => setFilter(athlete)}
                        >
                          {athlete !== "Everyone" && <span className={`dot athlete-${iconForAthlete(athlete)}`} />}
                          {athlete}
                        </button>
                      ))}
                    </div>

                    <div className="calendar-header">
                      <button onClick={() => setSelectedDate(new Date(selectedDate.getTime() - 7 * 24 * 60 * 60 * 1000))}>‹</button>
                      <strong>{view === "week" ? `${daysInWeek[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${daysInWeek[daysInWeek.length - 1].toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(selectedDate)}</strong>
                      <button onClick={() => setSelectedDate(new Date(selectedDate.getTime() + 7 * 24 * 60 * 60 * 1000))}>›</button>
                    </div>

                    {view === "week" ? (
                      <div className="week-grid">
                        {daysInWeek.map((date) => {
                          const isSelected = formatKey(date) === formatKey(selectedDate);
                          const dayEvents = filteredEvents.filter((event) => formatKey(new Date(event.start)) === formatKey(date));
                          return (
                            <button key={date.toISOString()} className={isSelected ? "day-pill selected" : "day-pill"} onClick={() => setSelectedDate(date)}>
                              <span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date)}</span>
                              <strong>{date.getDate()}</strong>
                              <small>
                                {dayEvents.slice(0, 3).map((event) => (
                                  <span key={event.id} className={`tiny-dot ${iconForAthlete(event.athlete)}`} />
                                ))}
                              </small>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="month-grid">
                        {Array.from({ length: 7 }, (_, index) => (
                          <div key={index} className="month-label">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][index]}</div>
                        ))}
                        {monthDays.map((date) => {
                          const matches = filteredEvents.filter((event) => formatKey(new Date(event.start)) === formatKey(date));
                          const isSelected = formatKey(date) === formatKey(selectedDate);
                          return (
                            <button key={date.toISOString()} className={isSelected ? "month-day selected" : "month-day"} onClick={() => setSelectedDate(date)}>
                              <span>{date.getDate()}</span>
                              {matches.slice(0, 3).map((event) => (
                                <small key={event.id} className={event.athlete === "Jordan" ? "event-dot event-dot-j" : "event-dot event-dot-a"}>{event.title}</small>
                              ))}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="day-header">
                      <strong>{formatLongDate(selectedDate.toISOString())}</strong>
                      <span>{selectedDayEvents.length} {selectedDayEvents.length === 1 ? "event" : "events"}</span>
                    </div>

                    <div className="event-list">
                      {selectedDayEvents.length ? (
                        selectedDayEvents.map((event) => (
                          <div key={event.id} className="event-item">
                            <div className="event-time">
                              <strong>{new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(event.start))}</strong>
                              <small>{new Intl.DateTimeFormat("en-US", { minute: "2-digit" }).format(new Date(event.start))}</small>
                            </div>
                            <div className={`event-bar ${event.athlete === "Jordan" ? "bar-j" : "bar-a"}`} />
                            <div className="event-copy">
                              <span className={`tag ${event.athlete === "Jordan" ? "tag-j" : "tag-a"}`}>{event.athlete} · {event.sport}</span>
                              <h4>{event.title}</h4>
                              <p>{event.team}</p>
                              <p>⌖ {event.location}</p>
                            </div>
                            <div className="event-source">{event.source}</div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-state">No events this day. Try another date or add one.</div>
                      )}
                    </div>
                  </div>

                  <aside className="side-rail">
                    <div className="rail-card">
                      <h3>Heads up</h3>
                      <span className="mini-tag">SCHEDULE OVERLAP</span>
                      <h4>Two places.<br />One you.</h4>
                      <p>Avery and Jordan have overlapping events. Tap Rides to line up a driver.</p>
                      <button className="outline-button" onClick={() => setActiveTab("Rides")}>Plan the rides</button>
                    </div>
                    <div className="rail-card">
                      <h3>One place beats five.</h3>
                      <div className="logo-row"><span>SE</span><span>TS</span><span>LA</span><span>CB</span><span>SC</span><span>SS</span></div>
                      <p>The real family version connects live sports calendars automatically.</p>
                      <button className="text-link" onClick={() => setActiveTab("Apps")}>View demo connections</button>
                    </div>
                  </aside>
                </div>
              </>
            )}

            {activeTab === "Teams" && (
              <div className="teams-grid">
                {[
                  { name: "Northside Lacrosse", athlete: "Avery", icon: "🥍" },
                  { name: "Velocity Lacrosse", athlete: "Avery", icon: "⚡" },
                  { name: "Town Hoops", athlete: "Jordan", icon: "🏀" },
                  { name: "Wildcats Flag", athlete: "Jordan", icon: "🏈" },
                ].map((team) => (
                  <div key={team.name} className="team-card">
                    <div className="team-icon">{team.icon}</div>
                    <h3>{team.name}</h3>
                    <p>{team.athlete} · Sample team</p>
                    <button className="outline-button" onClick={() => { setFilter(team.athlete as Athlete); setActiveTab("Calendar"); }}>View lineup</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Rides" && (
              <div className="panel-box">
                {filteredEvents.slice(0, 5).map((event) => (
                  <div key={event.id} className="ride-row">
                    <div className="avatar small">{event.athlete[0]}</div>
                    <div className="ride-copy">
                      <strong>{event.title}</strong>
                      <span>{formatDate(event.start)} · {formatTime(event.start)} · {event.location}</span>
                    </div>
                    <button className="outline-button">Assign driver</button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "Chat" && (
              <div className="chat-box">
                <div className="chat-rooms">
                  <button className="active">Family</button>
                  <button>Carpool</button>
                  <button>Weekend</button>
                </div>
                <div className="chat-panel">
                  <h3>Family chat</h3>
                  <div className="chat-thread">
                    <div className="chat-message">
                      <div className="avatar small">M</div>
                      <div className="bubble">I can drive to Saturday’s game.</div>
                    </div>
                    <div className="chat-message">
                      <div className="avatar small">T</div>
                      <div className="bubble">Perfect—I’ll handle pickup.</div>
                    </div>
                    {message && (
                      <div className="chat-message">
                        <div className="avatar small">Y</div>
                        <div className="bubble">{message}</div>
                      </div>
                    )}
                  </div>
                  <div className="composer">
                    <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a demo message…" />
                    <button className="primary-button" onClick={() => setMessage("")}>Send</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "Apps" && (
              <div className="panel-box apps-box">
                {[
                  "SportsEngine",
                  "TeamSnap",
                  "LeagueApps",
                  "Crossbar",
                  "Sports Connect",
                  "Sprocket Sports",
                ].map((name, index) => (
                  <div key={name} className="app-row">
                    <div className="app-logo">{["SE", "TS", "LA", "CB", "SC", "SS"][index]}</div>
                    <div>
                      <strong>{name}</strong>
                      <small>Sample calendar connection</small>
                    </div>
                    <span className="status-dot">● ACTIVE</span>
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      <div className={modalOpen ? "modal-backdrop visible" : "modal-backdrop"} onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}>
        <div className="modal-card">
          <button className="close-button" onClick={() => setModalOpen(false)}>×</button>
          <div className="eyebrow">PUBLIC DEMO</div>
          <h2>Add a sample event</h2>
          <p>This event is saved only in this browser.</p>

          <div className="modal-form">
            <label>
              Event name
              <input id="event-title" type="text" placeholder="Practice, game, tournament…" />
            </label>
            <div className="two-col">
              <label>
                Athlete
                <select id="event-athlete" defaultValue="Avery">
                  <option value="Avery">Avery</option>
                  <option value="Jordan">Jordan</option>
                </select>
              </label>
              <label>
                Sport
                <select id="event-sport" defaultValue="Lacrosse">
                  <option>Lacrosse</option>
                  <option>Basketball</option>
                  <option>Football</option>
                  <option>Soccer</option>
                </select>
              </label>
            </div>
            <label>
              Date and time
              <input id="event-date" type="datetime-local" defaultValue={new Date().toISOString().slice(0, 16)} />
            </label>
            <label>
              Location
              <input id="event-location" type="text" placeholder="Field or gym" />
            </label>
            <button className="primary-button full" onClick={addEvent}>Add to demo</button>
          </div>
        </div>
      </div>
    </>
  );
}
