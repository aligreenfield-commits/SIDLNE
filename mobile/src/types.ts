export type EventItem = {
  id: string;
  title: string;
  team: string;
  athlete: string;
  sport: string;
  location: string;
  start: string;
  end?: string;
  time: string;
};

export type TeamItem = {
  id: string;
  name: string;
  athlete: string;
  sport: string;
};

export const sampleEvents: EventItem[] = [
  {
    id: '1',
    title: 'Lacrosse practice',
    team: 'Northside Lacrosse',
    athlete: 'Avery',
    sport: 'Lacrosse',
    location: 'Community Field',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 0.5).toISOString(),
    time: 'Today · 5:30 PM',
  },
  {
    id: '2',
    title: 'Basketball game',
    team: 'Town Hoops',
    athlete: 'Jordan',
    sport: 'Basketball',
    location: 'Middle School Gym',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 1.2).toISOString(),
    time: 'Tomorrow · 6:00 PM',
  },
  {
    id: '3',
    title: 'Skills & drills',
    team: 'Velocity Lacrosse',
    athlete: 'Avery',
    sport: 'Lacrosse',
    location: 'Riverfront Park',
    start: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
    time: 'Thu · 10:00 AM',
  },
];

export const sampleTeams: TeamItem[] = [
  { id: '1', name: 'Northside Lacrosse', athlete: 'Avery', sport: 'Lacrosse' },
  { id: '2', name: 'Velocity Lacrosse', athlete: 'Avery', sport: 'Lacrosse' },
  { id: '3', name: 'Town Hoops', athlete: 'Jordan', sport: 'Basketball' },
  { id: '4', name: 'Wildcats Flag', athlete: 'Jordan', sport: 'Football' },
];
