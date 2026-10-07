/** MatchUp Auckland re-seed script — wipes ALL activities + chats, then seeds 100 fresh Auckland activities. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { firestore, rtdb } from '../database/firebase.js';
import { env } from '../config/env.js';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const DISCOVERY_IMG = join(REPO_ROOT, 'apps', 'mobile', 'assets', 'images', 'discovery');
const WELCOME_IMG = join(REPO_ROOT, 'apps', 'mobile', 'assets', 'images', 'welcome');
const ONBOARDING_IMG = join(REPO_ROOT, 'apps', 'mobile', 'assets', 'images', 'onboarding');

// Seeded RNG (mulberry32).

let rngState = 0xa6aa; // fixed seed → reproducible dataset
function rand(): number {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
function intBetween(min: number, max: number): number {
  return min + Math.floor(rand() * (max - min + 1));
}
function shuffled<T>(arr: readonly T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

// Geohash (same algorithm as the mobile client seed.ts).

const GEOHASH_ALPHABET = '0123456789bcdefghjkmnpqrstuvwxyz';

function geohashEncode(latitude: number, longitude: number, precision = 7): string {
  let latLow = -90;
  let latHigh = 90;
  let lonLow = -180;
  let lonHigh = 180;
  let buffer = '';
  let bits = 0;
  let bit = 0;
  let even = true;
  while (buffer.length < precision) {
    if (even) {
      const mid = (lonLow + lonHigh) / 2;
      if (longitude >= mid) {
        bits = (bits << 1) | 1;
        lonLow = mid;
      } else {
        bits = bits << 1;
        lonHigh = mid;
      }
    } else {
      const mid = (latLow + latHigh) / 2;
      if (latitude >= mid) {
        bits = (bits << 1) | 1;
        latLow = mid;
      } else {
        bits = bits << 1;
        latHigh = mid;
      }
    }
    even = !even;
    bit += 1;
    if (bit === 5) {
      buffer += GEOHASH_ALPHABET[bits & 0x1f];
      bits = 0;
      bit = 0;
    }
  }
  return buffer;
}

// Auckland venues (real places, real coordinates).

type Venue = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  sports: string[];
};

const VENUES: Venue[] = [
  {
    name: 'Auckland Domain Courts',
    address: 'Park Road, Grafton, Auckland',
    latitude: -36.8605,
    longitude: 174.7787,
    sports: ['Basketball', 'Running', 'Fitness'],
  },
  {
    name: 'Eden Park Outer Oval',
    address: 'Reimers Avenue, Kingsland, Auckland',
    latitude: -36.875,
    longitude: 174.745,
    sports: ['Football', 'Running', 'Fitness'],
  },
  {
    name: 'Mission Bay Beach',
    address: 'Tamaki Drive, Mission Bay, Auckland',
    latitude: -36.852,
    longitude: 174.828,
    sports: ['Volleyball', 'Running', 'Fitness'],
  },
  {
    name: 'Cornwall Park',
    address: 'Green Lane West, Epsom, Auckland',
    latitude: -36.9007,
    longitude: 174.8245,
    sports: ['Running', 'Cycling', 'Fitness'],
  },
  {
    name: 'Parnell Tennis Centre',
    address: 'Heather Street, Parnell, Auckland',
    latitude: -36.8523,
    longitude: 174.781,
    sports: ['Tennis'],
  },
  {
    name: 'Eventfinda Stadium',
    address: 'Silverfield Lane, Wairau Valley, Auckland',
    latitude: -36.7925,
    longitude: 174.7515,
    sports: ['Volleyball', 'Basketball', 'Badminton'],
  },
  {
    name: 'Takapuna Beach Reserve',
    address: 'The Strand, Takapuna, Auckland',
    latitude: -36.7862,
    longitude: 174.7738,
    sports: ['Volleyball', 'Running', 'Swimming'],
  },
  {
    name: 'Lake Pupuke Courts',
    address: 'Northcote Road, Takapuna, Auckland',
    latitude: -36.7833,
    longitude: 174.7667,
    sports: ['Tennis', 'Running'],
  },
  {
    name: 'Mt Eden Village Green',
    address: 'Mt Eden Road, Mt Eden, Auckland',
    latitude: -36.8189,
    longitude: 174.7643,
    sports: ['Football', 'Running', 'Fitness'],
  },
  {
    name: 'One Tree Hill Lower Fields',
    address: 'Manukau Road, Epsom, Auckland',
    latitude: -36.9003,
    longitude: 174.8246,
    sports: ['Football', 'Running'],
  },
  {
    name: 'Western Springs Park',
    address: 'Great North Road, Western Springs, Auckland',
    latitude: -36.8642,
    longitude: 174.7237,
    sports: ['Running', 'Cycling', 'Football'],
  },
  {
    name: 'Grey Lynn Park',
    address: 'Dryden Street, Grey Lynn, Auckland',
    latitude: -36.8625,
    longitude: 174.72,
    sports: ['Football', 'Tennis', 'Fitness'],
  },
  {
    name: "Cox's Bay Reserve",
    address: 'West End Road, Westmere, Auckland',
    latitude: -36.86,
    longitude: 174.73,
    sports: ['Running', 'Football'],
  },
  {
    name: 'Albert Park',
    address: 'Bowen Avenue, Auckland CBD',
    latitude: -36.8508,
    longitude: 174.7673,
    sports: ['Fitness', 'Running', 'Badminton'],
  },
  {
    name: 'Victoria Park',
    address: 'Victoria Street West, Freemans Bay, Auckland',
    latitude: -36.856,
    longitude: 174.752,
    sports: ['Basketball', 'Tennis', 'Fitness'],
  },
  {
    name: 'Silo Park Courts',
    address: 'Beaumont Street, Wynyard Quarter, Auckland',
    latitude: -36.8415,
    longitude: 174.753,
    sports: ['Basketball', 'Volleyball'],
  },
  {
    name: 'Three Lamps Reserve',
    address: 'Ponsonby Road, Ponsonby, Auckland',
    latitude: -36.858,
    longitude: 174.745,
    sports: ['Fitness', 'Running'],
  },
  {
    name: 'Mt Albert Leisure Centre',
    address: 'Alberton Avenue, Mt Albert, Auckland',
    latitude: -36.885,
    longitude: 174.721,
    sports: ['Basketball', 'Badminton', 'Swimming'],
  },
  {
    name: 'Ellerslie Leisure Centre',
    address: 'Main Highway, Ellerslie, Auckland',
    latitude: -36.9,
    longitude: 174.82,
    sports: ['Badminton', 'Basketball', 'Fitness'],
  },
  {
    name: 'Lloyd Elsmore Park',
    address: 'Pakuranga Road, Pakuranga, Auckland',
    latitude: -36.91,
    longitude: 174.87,
    sports: ['Football', 'Tennis', 'Running'],
  },
  {
    name: 'Barry Curtis Park',
    address: 'Chapel Road, Flat Bush, Auckland',
    latitude: -36.94,
    longitude: 174.9,
    sports: ['Football', 'Cycling', 'Running'],
  },
  {
    name: 'North Harbour Stadium Outer Fields',
    address: 'Stadium Drive, Albany, Auckland',
    latitude: -36.723,
    longitude: 174.704,
    sports: ['Football', 'Running'],
  },
  {
    name: 'Long Bay Regional Park',
    address: 'Beach Road, Long Bay, Auckland',
    latitude: -36.68,
    longitude: 174.75,
    sports: ['Running', 'Cycling', 'Swimming'],
  },
  {
    name: 'Milford Beach',
    address: 'Craig Road, Milford, Auckland',
    latitude: -36.77,
    longitude: 174.77,
    sports: ['Volleyball', 'Swimming'],
  },
  {
    name: 'Windsor Reserve',
    address: 'Victoria Road, Devonport, Auckland',
    latitude: -36.83,
    longitude: 174.795,
    sports: ['Football', 'Running', 'Fitness'],
  },
  {
    name: 'Michael Savage Memorial Park',
    address: 'Hapimana Street, Orakei, Auckland',
    latitude: -36.855,
    longitude: 174.83,
    sports: ['Running', 'Cycling', 'Fitness'],
  },
  {
    name: 'Orakei Basin Track',
    address: 'Orakei Road, Remuera, Auckland',
    latitude: -36.87,
    longitude: 174.81,
    sports: ['Running', 'Cycling'],
  },
  {
    name: 'Panmure Basin',
    address: 'Cleary Road, Panmure, Auckland',
    latitude: -36.85,
    longitude: 174.85,
    sports: ['Running', 'Cycling'],
  },
  {
    name: 'Onehunga Bay Reserve',
    address: 'Beachcroft Avenue, Onehunga, Auckland',
    latitude: -36.92,
    longitude: 174.78,
    sports: ['Football', 'Volleyball'],
  },
  {
    name: 'Keith Hay Park',
    address: 'Arundel Street, Mt Roskill, Auckland',
    latitude: -36.91,
    longitude: 174.74,
    sports: ['Football', 'Tennis', 'Cricket'],
  },
  {
    name: 'Trusts Stadium',
    address: 'Central Park Drive, Henderson, Auckland',
    latitude: -36.87,
    longitude: 174.63,
    sports: ['Basketball', 'Volleyball', 'Badminton'],
  },
  {
    name: 'Olympic Park',
    address: 'Portage Road, New Lynn, Auckland',
    latitude: -36.91,
    longitude: 174.68,
    sports: ['Football', 'Running', 'Fitness'],
  },
  {
    name: 'Blockhouse Bay Reserve',
    address: 'Endeavour Street, Blockhouse Bay, Auckland',
    latitude: -36.88,
    longitude: 174.69,
    sports: ['Tennis', 'Football'],
  },
  {
    name: 'Mt Smart Stadium Grounds',
    address: 'O’Rorke Road, Penrose, Auckland',
    latitude: -36.92,
    longitude: 174.81,
    sports: ['Football', 'Running'],
  },
  {
    name: 'Parnell Baths',
    address: 'Judges Bay Road, Parnell, Auckland',
    latitude: -36.852,
    longitude: 174.782,
    sports: ['Swimming'],
  },
  {
    name: 'Point Erin Pools',
    address: 'Shelly Beach Road, Ponsonby, Auckland',
    latitude: -36.847,
    longitude: 174.75,
    sports: ['Swimming'],
  },
  {
    name: 'Remuera Tennis Club',
    address: 'Clonbern Road, Remuera, Auckland',
    latitude: -36.885,
    longitude: 174.81,
    sports: ['Tennis'],
  },
  {
    name: 'Howick Recreation Centre',
    address: 'Uxbridge Road, Howick, Auckland',
    latitude: -36.895,
    longitude: 174.93,
    sports: ['Badminton', 'Basketball'],
  },
  {
    name: 'Avondale Racecourse Grounds',
    address: 'Ash Street, Avondale, Auckland',
    latitude: -36.89,
    longitude: 174.7,
    sports: ['Football', 'Cycling', 'Running'],
  },
  {
    name: 'Bastion Point Lawns',
    address: 'Tamaki Drive, Orakei, Auckland',
    latitude: -36.858,
    longitude: 174.825,
    sports: ['Fitness', 'Running'],
  },
];

// Sports config.

type SportConfig = {
  sport: string;
  capacityRange: [number, number];
  durations: number[];
  fees: number[];
  covers: string[];
  titles: string[];
  descriptions: string[];
  bring: string[];
};

const COVER = {
  // Basketball (all verified: courts, games, balls).
  basketball1: join(DISCOVERY_IMG, 'covers', 'basketball_1.png'),
  basketball2: join(DISCOVERY_IMG, 'covers', 'basketball_2.png'),
  basketball3: join(DISCOVERY_IMG, 'covers', 'basketball_3.png'),
  basketballFull: join(DISCOVERY_IMG, 'covers', 'basketball_full.png'),
  basketballCourt: join(DISCOVERY_IMG, 'covers', 'hero_joined.png'),
  basketballGame1: join(ONBOARDING_IMG, 'illustration_1.png'),
  basketballGame2: join(ONBOARDING_IMG, 'onb_1.png'),
  // Tennis (court art + serve photo).
  tennisCourt: join(DISCOVERY_IMG, 'covers', 'tennis_5.png'),
  tennisServe: join(WELCOME_IMG, 'img_1.png'),
  // Volleyball.
  volleyball: join(DISCOVERY_IMG, 'sports', 'volleyball.png'),
  // Football (pitch + team celebration photos).
  footballPitch: join(WELCOME_IMG, 'img_4.png'),
  footballTeam1: join(ONBOARDING_IMG, 'illustration_3.png'),
  footballTeam2: join(ONBOARDING_IMG, 'onb_3.png'),
  // Running (trail shoes + track sprint photos).
  runningShoes: join(WELCOME_IMG, 'img_3.png'),
  runningTrack1: join(ONBOARDING_IMG, 'illustration_2.png'),
  runningTrack2: join(ONBOARDING_IMG, 'onb_2.png'),
  // Swimming (lane pool photo).
  swimLanes: join(WELCOME_IMG, 'img_2.png'),
  // Badminton / Cycling / Fitness (sourced photos, verified visually).
  badminton1: join(DISCOVERY_IMG, 'covers', 'badminton_1.jpg'),
  badminton2: join(DISCOVERY_IMG, 'covers', 'badminton_2.jpg'),
  cycling1: join(DISCOVERY_IMG, 'covers', 'cycling_1.jpg'),
  cycling2: join(DISCOVERY_IMG, 'covers', 'cycling_2.jpg'),
  fitness1: join(DISCOVERY_IMG, 'covers', 'fitness_1.jpg'),
  fitness2: join(DISCOVERY_IMG, 'covers', 'fitness_2.jpg'),
  // Multi-sport collage — last-resort fallback only, never primary.
  collage: join(WELCOME_IMG, 'collage.png'),
};

const SPORTS: SportConfig[] = [
  {
    sport: 'Basketball',
    capacityRange: [6, 12],
    durations: [60, 90, 120],
    fees: [5, 8, 10],
    covers: [
      COVER.basketball1,
      COVER.basketball2,
      COVER.basketball3,
      COVER.basketballFull,
      COVER.basketballCourt,
      COVER.basketballGame1,
      COVER.basketballGame2,
    ],
    titles: [
      '{daypart} {n}v{n} Basketball Runs',
      'Pickup Basketball at {venueShort}',
      '{daypart} Full-Court Basketball',
      'Social Basketball — All Welcome',
      'Weeknight Hoops Session',
    ],
    descriptions: [
      'Friendly full-court runs at {venue}. {level} level, usually 3–4 games with rolling subs. Bring a dark and a white top so we can split teams quickly.',
      'Casual pickup basketball at {venue}. Winners stay on — all skill levels get a run. {bring}',
      'Half-court 3v3 and full-court 5v5 depending on numbers at {venue}. {level} friendly — come down for a run and stay for the banter.',
    ],
    bring: [
      'Bring your own ball if you have one — we share.',
      'Bibs provided, just bring indoor court shoes.',
      'Bring water and a ball if you can.',
    ],
  },
  {
    sport: 'Football',
    capacityRange: [8, 14],
    durations: [60, 90, 120],
    fees: [5, 8, 10],
    covers: [COVER.footballPitch, COVER.footballTeam1, COVER.footballTeam2],
    titles: [
      '{daypart} {n}-a-side Football',
      'Social Football at {venueShort}',
      'Pickup Soccer — {venueShort}',
      '{daypart} Turf Football Session',
    ],
    descriptions: [
      'Weekly social football on the turf at {venue}. {level} — mixed abilities, friendly but competitive. {bring}',
      'Casual {n}-a-side games at {venue}. Two touch max keeps it flowing. {level} players all welcome, just bring boots (no metal studs).',
      'Pickup soccer under lights at {venue}. We split evenly and rotate keepers. {bring}',
    ],
    bring: [
      'Bibs provided, just bring boots and water.',
      'Bring a dark shirt; bibs for the other team.',
      'Shin pads recommended. Balls provided.',
    ],
  },
  {
    sport: 'Tennis',
    capacityRange: [2, 4],
    durations: [60, 90],
    fees: [8, 10, 12],
    covers: [COVER.tennisCourt, COVER.tennisServe],
    titles: [
      '{daypart} Tennis {format}',
      'Social Tennis at {venueShort}',
      'Tennis {format} — {level} Friendly',
    ],
    descriptions: [
      'Casual tennis {formatLower} at {venue}. {level} welcome — I have spare racquets if you need one. Balls provided, just bring yourself.',
      'Social hits at {venue}. We rotate partners every set so everyone gets court time. {level} level, relaxed vibe.',
      'Tennis {formatLower} at {venue}. New balls supplied each session. {bring}',
    ],
    bring: [
      'Bring your racquet if you have one; spares available.',
      'Wear non-marking court shoes please.',
      'Sunscreen and water recommended for day sessions.',
    ],
  },
  {
    sport: 'Running',
    capacityRange: [5, 20],
    durations: [45, 60, 90],
    fees: [0, 5],
    covers: [COVER.runningShoes, COVER.runningTrack1, COVER.runningTrack2],
    titles: [
      '{daypart} {dist} Group Run',
      'Social {dist} at {venueShort}',
      '{venueShort} Runners Club',
      'Easy-Pace {dist} + Coffee',
    ],
    descriptions: [
      'Easy {distLower} loop starting at {venue}. Casual pace — no one gets dropped, we regroup at every kilometre. Coffee afterwards for anyone keen.',
      'Social running group meeting at {venue}. {level} runners welcome; run-walk is totally fine. {bring}',
      'Group {distLower} around {venue}. All paces catered for with a sweeper at the back. Headtorch required for evening runs in winter.',
    ],
    bring: [
      'Bring water and wear reflective gear after dark.',
      'All you need is shoes — we take care of the route.',
      'Bring a friend; the more the merrier.',
    ],
  },
  {
    sport: 'Volleyball',
    capacityRange: [6, 12],
    durations: [90, 120],
    fees: [5, 8, 10],
    covers: [COVER.volleyball],
    titles: [
      '{daypart} {format} Volleyball',
      'Social Volleyball at {venueShort}',
      'Beach Volleyball — {venueShort}',
    ],
    descriptions: [
      'Social {formatLower} volleyball at {venue}. {level} — rotating teams so everyone plays equal time. {bring}',
      'Fun-first volleyball at {venue}. Mixed levels, mixed teams, zero ego. {level} players welcome, first-timers get a quick rules rundown.',
      '{format} volleyball at {venue}. {bring} Come for the rallies, stay for the sunset.',
    ],
    bring: [
      'Knee pads optional but handy on hard courts.',
      'Bring sunscreen and water for beach sessions.',
      'Balls and net provided — just bring energy.',
    ],
  },
  {
    sport: 'Badminton',
    capacityRange: [2, 8],
    durations: [60, 90, 120],
    fees: [8, 10, 12],
    covers: [COVER.badminton1, COVER.badminton2],
    titles: [
      '{daypart} Badminton {format}',
      'Social Badminton at {venueShort}',
      'Badminton Ladder Night',
    ],
    descriptions: [
      'Social badminton {formatLower} at {venue}. {level} — courts booked back-to-back, rotate in after each game. {bring}',
      'Casual badminton night at {venue}. Feather shuttles provided. {level} players all welcome.',
      'Badminton {formatLower} with rotating partners at {venue}. Great workout, better company. {bring}',
    ],
    bring: [
      'Bring your racquet; a few spares available.',
      'Non-marking court shoes required.',
      'Shuttles supplied — just bring yourself.',
    ],
  },
  {
    sport: 'Cycling',
    capacityRange: [4, 15],
    durations: [90, 120, 180],
    fees: [0, 5],
    covers: [COVER.cycling1, COVER.cycling2],
    titles: [
      '{daypart} {dist} Group Ride',
      'Social Ride from {venueShort}',
      '{venueShort} Cycling Crew',
    ],
    descriptions: [
      'No-drop group ride starting at {venue}, roughly {distLower}. {level} riders welcome — we regroup at the top of every climb. Helmets mandatory.',
      'Social cycling loop out of {venue}. Coffee stop halfway is non-negotiable. {bring}',
      'Weekend bunch ride from {venue}. {level} pace with a sweeper. {bring}',
    ],
    bring: [
      'Helmet, spare tube and lights required.',
      'Bring a lock for the coffee stop.',
      'E-bikes welcome — no judgement here.',
    ],
  },
  {
    sport: 'Swimming',
    capacityRange: [4, 10],
    durations: [45, 60, 90],
    fees: [8, 10, 15],
    covers: [COVER.swimLanes],
    titles: ['{daypart} Lane Swimming Squad', 'Ocean Swim at {venueShort}', 'Social Swim + Sauna'],
    descriptions: [
      'Lane swimming squad at {venue}. {level} — we split lanes by pace so everyone gets a good workout. {bring}',
      'Group ocean swim at {venue} (conditions permitting — check the chat on the day). Safety buoy recommended. {level} swimmers welcome with a buddy.',
      'Social swim session at {venue} followed by sauna and a debrief. {level} friendly. {bring}',
    ],
    bring: [
      'Bring goggles, cap and a towel.',
      'Wetsuit recommended for ocean swims under 18°C.',
      'Pool entry included in the fee — just bring your gear.',
    ],
  },
  {
    sport: 'Fitness',
    capacityRange: [4, 20],
    durations: [45, 60],
    fees: [5, 10, 15],
    covers: [COVER.fitness1, COVER.fitness2],
    titles: [
      '{daypart} Bootcamp at {venueShort}',
      'Outdoor HIIT Session',
      'Sunrise Yoga + Bodyweight',
      'Park Fitness Crew',
    ],
    descriptions: [
      'Outdoor bootcamp at {venue}. {level} — bodyweight circuits scaled to every fitness level. {bring}',
      'High-energy park workout at {venue}. 45 minutes, zero equipment needed, maximum good vibes. {bring}',
      'Morning movement session at {venue}: mobility, bodyweight strength and a stretch to finish. {level} friendly.',
    ],
    bring: [
      'Bring a mat and water bottle.',
      'Towel and water — you will sweat.',
      'All equipment provided, just bring yourself.',
    ],
  },
];

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'any'] as const;
const DAYPARTS = [
  'Morning',
  'Midday',
  'Afternoon',
  'Evening',
  'Sunset',
  'Weekend',
  'Sunrise',
  'Twilight',
] as const;
const START_HOURS = [6, 7, 8, 9, 10, 12, 13, 16, 17, 18, 19] as const;
const PAID_FEES = [5, 8, 10, 12, 15, 20] as const;

const HOST_OPENERS = [
  'Hey everyone! Thanks for joining — really looking forward to this one.',
  'Welcome all! I’ll post final details here the night before.',
  'Kia ora team! Drop a message below to introduce yourself.',
  'Hey team, stoked to have you on board. Any questions, just ask here.',
];
const LOGISTICS_MSGS = [
  'Reminder: please arrive 10–15 minutes early so we can start on time.',
  'Weather looks good for our session — see you all there!',
  'If you can no longer make it, please leave the activity so someone else can grab your spot.',
  'Parking is easiest on the side streets — allow a few extra minutes.',
];
const PAID_MSGS = [
  'The entry fee is ${fee} per person — cash or bank transfer on the day works.',
  'Fee of ${fee} covers the venue booking. Flick me a message if you need the account number.',
];
const SPLIT_TOTALS = [40, 60, 80, 100, 120] as const;
const SPLIT_MSGS = [
  'Venue hire is ${total} total split between us — about ${fee} each if ${min} join, cheaper when full.',
  'We split the ${total} court cost — works out to max ${fee} per person, less if more show up.',
];
const APPROVAL_MSGS = [
  'Thanks for your patience — I approve requests every evening, so sit tight!',
  'Quick note: please add a line about your experience level when you request to join.',
];

// Helpers.

function daysAgo(n: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

function startEndIso(
  inDays: number,
  hour: number,
  minute: number,
  durationMinutes: number,
): { startTime: string; endTime: string } {
  const d = new Date();
  d.setDate(d.getDate() + inDays);
  d.setHours(hour, minute, 0, 0);
  return {
    startTime: d.toISOString(),
    endTime: new Date(d.getTime() + durationMinutes * 60 * 1000).toISOString(),
  };
}

function venueShort(name: string): string {
  return name.split(' ').slice(0, 2).join(' ');
}

function fillTemplate(template: string, ctx: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(ctx)) {
    out = out.split(`{${key}}`).join(value);
  }
  return out;
}

async function resolveBucket() {
  const candidates = [
    `${env.FIREBASE_PROJECT_ID}.firebasestorage.app`,
    `${env.FIREBASE_PROJECT_ID}.appspot.com`,
  ];
  for (const name of candidates) {
    try {
      const bucket = getStorage().bucket(name);
      const [exists] = await bucket.exists();
      if (exists) return bucket;
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(
    `No Cloud Storage bucket found (tried ${candidates.join(', ')}). ` +
      'Enable Storage in the Firebase console first.',
  );
}

async function uploadCover(
  bucket: Awaited<ReturnType<typeof resolveBucket>>,
  localPath: string,
  destPath: string,
): Promise<string> {
  const data = await readFile(localPath);
  const file = bucket.file(destPath);
  await file.save(data, {
    contentType:
      localPath.endsWith('.jpg') || localPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png',
    metadata: { cacheControl: 'public, max-age=31536000' },
  });
  try {
    await file.makePublic();
  } catch {
    const [signedUrl] = await file.getSignedUrl({ action: 'read', expires: '2036-01-01' });
    return signedUrl;
  }
  return `https://storage.googleapis.com/${bucket.name}/${destPath}`;
}

/** Commit set-ops in chunks (Firestore batches cap at 500 writes). */
async function commitChunks(
  ops: { ref: FirebaseFirestore.DocumentReference; data: Record<string, unknown> }[],
): Promise<void> {
  const CHUNK = 400;
  for (let i = 0; i < ops.length; i += CHUNK) {
    const batch = firestore.batch();
    for (const op of ops.slice(i, i + CHUNK)) {
      batch.set(op.ref, op.data);
    }
    await batch.commit();
  }
}

// Wipe.

async function wipeAll(): Promise<{ deletedActivityIds: string[]; userIds: string[] }> {
  console.log('WIPE: listing activities...');
  const activitiesSnap = await firestore.collection('activities').get();
  const deletedActivityIds = activitiesSnap.docs.map((d) => d.id);
  console.log(`WIPE: deleting ${deletedActivityIds.length} activities + subcollections...`);

  const subcollections = ['participants', 'joinRequests', 'ratings', 'attendance'];
  const deleteOps: FirebaseFirestore.DocumentReference[] = [];
  for (const activityId of deletedActivityIds) {
    for (const sub of subcollections) {
      const docs = await firestore.collection(`activities/${activityId}/${sub}`).listDocuments();
      deleteOps.push(...docs);
    }
    deleteOps.push(firestore.doc(`activities/${activityId}`));
  }
  for (let i = 0; i < deleteOps.length; i += 400) {
    const batch = firestore.batch();
    for (const ref of deleteOps.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  console.log(`WIPE: deleted ${deleteOps.length} Firestore docs (activities + subcollections).`);

  // Users (needed for swipe/notification cleanup + host pool).
  const usersSnap = await firestore.collection('users').get();
  const userIds = usersSnap.docs.map((d) => d.id);

  // Orphaned swipes + activity-linked notifications.
  const cleanupRefs: FirebaseFirestore.DocumentReference[] = [];
  let swipeCount = 0;
  let notifCount = 0;
  for (const uid of userIds) {
    const decisions = await firestore.collection(`swipes/${uid}/decisions`).listDocuments();
    cleanupRefs.push(...decisions);
    swipeCount += decisions.length;
    const notifsSnap = await firestore.collection(`users/${uid}/notifications`).get();
    for (const doc of notifsSnap.docs) {
      if (doc.data()?.activityId) {
        cleanupRefs.push(doc.ref);
        notifCount += 1;
      }
    }
  }
  for (let i = 0; i < cleanupRefs.length; i += 400) {
    const batch = firestore.batch();
    for (const ref of cleanupRefs.slice(i, i + 400)) batch.delete(ref);
    await batch.commit();
  }
  console.log(
    `WIPE: deleted ${swipeCount} orphaned swipe decisions, ${notifCount} activity-linked notifications.`,
  );

  // RTDB chats: group chats, typing indicators, DMs + DM inbox metadata.
  await rtdb.ref().update({
    activityChats: null,
    typing: null,
    dmChats: null,
    userDMs: null,
  });
  console.log('WIPE: cleared RTDB activityChats, typing, dmChats, userDMs.');

  // Old activity artwork (demo user avatars under seed/avatars are kept).
  try {
    const bucket = await resolveBucket();
    const [seedFiles] = await bucket.getFiles({ prefix: 'seed/covers/' });
    const [aklFiles] = await bucket.getFiles({ prefix: 'akl/covers/' });
    const stale = [...seedFiles, ...aklFiles];
    await Promise.all(stale.map((file) => file.delete()));
    console.log(
      `WIPE: deleted ${stale.length} old cover object(s) under seed/covers/ + akl/covers/.`,
    );
  } catch (error) {
    console.log(`WIPE: Storage cleanup skipped: ${(error as Error).message}`);
  }

  return { deletedActivityIds, userIds };
}

// Seed.

type HostPoolEntry = { uid: string; displayName: string };

async function main(): Promise<void> {
  await wipeAll();

  // Host pool: every user with a real display name.
  const usersSnap = await firestore.collection('users').get();
  const hosts: HostPoolEntry[] = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    if (typeof data?.displayName === 'string' && data.displayName.trim().length > 0) {
      hosts.push({ uid: doc.id, displayName: data.displayName.trim() });
    }
  }
  if (hosts.length === 0) {
    throw new Error('No users with a displayName found — cannot assign hosts. Create users first.');
  }
  console.log(
    `SEED: host pool = ${hosts.length} users: ${hosts.map((h) => h.displayName).join(', ')}`,
  );

  // Upload cover artwork once; map each sport to its image pool.
  const bucket = await resolveBucket();
  const coverUrlByFile = new Map<string, string>();
  const uniqueCovers = [...new Set(SPORTS.flatMap((s) => s.covers))].filter((p) => existsSync(p));
  await Promise.all(
    uniqueCovers.map(async (localPath, index) => {
      const url = await uploadCover(bucket, localPath, `akl/covers/cover-${index}.png`);
      coverUrlByFile.set(localPath, url);
    }),
  );
  console.log(`SEED: uploaded ${coverUrlByFile.size} cover images to akl/covers/.`);
  const fallbackCover = coverUrlByFile.get(COVER.collage) ?? [...coverUrlByFile.values()][0]!;

  // Scenario plan for the 100 activities (shuffled so ids mix scenarios): statuses: all fresh `open`.
  const TOTAL = 100;
  const plan = Array.from({ length: TOTAL }, (_, i) => {
    return {
      index: i,
      id: `akl-${String(i + 1).padStart(3, '0')}`,
      status: 'open' as const,
      joinPolicy: (rand() < 0.55 ? 'open' : 'approval') as 'open' | 'approval',
      paid: rand() < 0.3,
    };
  });
  const ordered = shuffled(plan);
  // Round-robin sport assignment (shuffled) so all 9 sports get ~11 activities each instead of leaving it to RNG.
  const sportOrder = shuffled(Array.from({ length: TOTAL }, (_, i) => SPORTS[i % SPORTS.length]!));

  const usedTitles = new Set<string>();
  const activityDocs: {
    ref: FirebaseFirestore.DocumentReference;
    data: Record<string, unknown>;
  }[] = [];
  const chatUpdates: Record<string, unknown> = {};
  const stats = { paid: 0, free: 0, open: 0, approval: 0, joinRequests: 0, messages: 0 };

  for (const slot of ordered) {
    const sportCfg = sportOrder[slot.index]!;
    const venuePool = VENUES.filter((v) => v.sports.includes(sportCfg.sport));
    const venue = pick(venuePool.length > 0 ? venuePool : VENUES);
    const host = pick(hosts);
    const others = shuffled(hosts.filter((h) => h.uid !== host.uid));

    const skillLevel = pick(SKILL_LEVELS);
    const daypart = pick(DAYPARTS);
    const durationMinutes = pick(sportCfg.durations);
    const [capMin, capMax] = sportCfg.capacityRange;
    const capacity = intBetween(capMin, capMax);

    const n = Math.max(2, Math.floor(capacity / 2));
    const format =
      sportCfg.sport === 'Tennis' || sportCfg.sport === 'Badminton'
        ? pick(['Singles', 'Doubles'])
        : sportCfg.sport === 'Volleyball'
          ? pick(['4v4', '6v6'])
          : '';
    const dist =
      sportCfg.sport === 'Running'
        ? pick(['5K', '8K', '10K', 'Half-Marathon Prep'])
        : pick(['15km', '30km', '50km']);
    let title = fillTemplate(pick(sportCfg.titles), {
      daypart,
      n: String(n),
      venueShort: venueShort(venue.name),
      format,
      level:
        skillLevel === 'any' ? 'All levels' : skillLevel[0]!.toUpperCase() + skillLevel.slice(1),
      dist,
    });
    if (usedTitles.has(title)) title = `${title} #${slot.index + 1}`;
    usedTitles.add(title);

    const levelLabel = skillLevel === 'any' ? 'All levels' : `${skillLevel} level`;
    const description = fillTemplate(pick(sportCfg.descriptions), {
      venue: venue.name,
      venueShort: venueShort(venue.name),
      level: levelLabel,
      n: String(n),
      format: format,
      formatLower: format.toLowerCase(),
      dist: dist,
      distLower: dist.toLowerCase(),
      daypart,
      bring: pick(sportCfg.bring),
    });

    const positiveFees = sportCfg.fees.filter((f) => f > 0);
    // ~30% paid; of the paid ones ~1/3 are split-cost (total shared) and the rest are fixed per-person.
    const isSplit = slot.paid && rand() < 0.35;
    const totalCost = isSplit ? pick([...SPLIT_TOTALS]) : undefined;
    const minPlayers = isSplit
      ? Math.max(2, Math.min(capacity, Math.floor(capacity / 2)))
      : undefined;
    const fee = !slot.paid
      ? undefined
      : isSplit && totalCost !== undefined && minPlayers !== undefined
        ? Math.round((totalCost / minPlayers) * 100) / 100
        : positiveFees.length > 0 && rand() < 0.7
          ? pick(positiveFees)
          : pick([...PAID_FEES]);
    const isPaid = slot.paid;
    if (isPaid) stats.paid += 1;
    else stats.free += 1;
    if (slot.joinPolicy === 'open') stats.open += 1;
    else stats.approval += 1;

    const inDays = intBetween(1, 14);
    const hour = pick(START_HOURS);
    const minute = pick([0, 30]);
    const { startTime, endTime } = startEndIso(inDays, hour, minute, durationMinutes);
    const createdDaysAgo = intBetween(0, 6);

    // Fresh activities: the host is the ONLY participant (participantCount = 1 everywhere — nobody has joined yet).
    const participantCount = 1;

    // Pending join requests on ~half of approval-gated activities, drawn from pool users other than the host.
    const nonMembers = others;
    let pendingRequestCount = 0;
    const requesters: HostPoolEntry[] = [];
    if (slot.joinPolicy === 'approval' && nonMembers.length > 0 && rand() < 0.5) {
      const want = Math.min(nonMembers.length, intBetween(1, 3));
      requesters.push(...nonMembers.slice(0, want));
      pendingRequestCount = requesters.length;
      stats.joinRequests += requesters.length;
    }

    const coverLocal = pick(sportCfg.covers);
    const coverImageUrl = (coverLocal && coverUrlByFile.get(coverLocal)) ?? fallbackCover;

    activityDocs.push({
      ref: firestore.doc(`activities/${slot.id}`),
      data: {
        hostId: host.uid,
        title,
        sportType: sportCfg.sport,
        description,
        locationName: venue.name,
        address: venue.address,
        latitude: venue.latitude,
        longitude: venue.longitude,
        geohash: geohashEncode(venue.latitude, venue.longitude),
        startTime,
        endTime,
        skillLevel,
        capacity,
        participantCount,
        pendingRequestCount,
        status: slot.status,
        coverImageUrl,
        joinPolicy: slot.joinPolicy,
        isPaid,
        ...(isPaid && fee !== undefined ? { fee } : {}),
        ...(isSplit
          ? {
              feeMode: 'split' as const,
              totalCost: totalCost!,
              minPlayers: minPlayers!,
            }
          : {}),
        createdAt: daysAgo(createdDaysAgo),
        updatedAt: daysAgo(0),
      },
    });

    const participantOps: {
      ref: FirebaseFirestore.DocumentReference;
      data: Record<string, unknown>;
    }[] = [
      {
        ref: firestore.doc(`activities/${slot.id}/participants/${host.uid}`),
        data: { uid: host.uid, joinedAt: daysAgo(createdDaysAgo) },
      },
      ...requesters.map((r) => ({
        ref: firestore.doc(`activities/${slot.id}/joinRequests/${r.uid}`),
        data: {
          uid: r.uid,
          activityId: slot.id,
          status: 'pending',
          createdAt: daysAgo(intBetween(0, 2)),
          updatedAt: daysAgo(0),
        },
      })),
    ];
    activityDocs.push(...participantOps);

    // Group chat: host-authored messages only (nobody else has joined yet).
    const chatTexts: { sender: HostPoolEntry; text: string }[] = [
      { sender: host, text: pick(HOST_OPENERS) },
    ];
    if (isPaid && fee !== undefined) {
      if (isSplit && totalCost !== undefined && minPlayers !== undefined) {
        chatTexts.push({
          sender: host,
          text: fillTemplate(pick(SPLIT_MSGS), {
            fee: String(fee),
            total: String(totalCost),
            min: String(minPlayers),
          }),
        });
      } else {
        chatTexts.push({ sender: host, text: fillTemplate(pick(PAID_MSGS), { fee: String(fee) }) });
      }
    }
    if (slot.joinPolicy === 'approval' && rand() < 0.5) {
      chatTexts.push({ sender: host, text: pick(APPROVAL_MSGS) });
    }
    if (rand() < 0.6) {
      chatTexts.push({ sender: host, text: pick(LOGISTICS_MSGS) });
    }
    chatTexts.forEach((msg, i) => {
      chatUpdates[`activityChats/${slot.id}/messages/akl-msg-${slot.index}-${i}`] = {
        senderId: msg.sender.uid,
        text: msg.text,
        type: 'text',
        timestamp:
          Date.now() - (chatTexts.length - i) * 47 * 60 * 1000 - intBetween(0, 30) * 60 * 1000,
      };
      stats.messages += 1;
    });
  }

  await commitChunks(activityDocs);
  console.log(
    `SEED: wrote ${activityDocs.length} Firestore docs (100 activities + participants + join requests).`,
  );

  await rtdb.ref().update(chatUpdates);
  console.log(`SEED: wrote ${stats.messages} RTDB chat messages across 100 activities.`);

  // Verify through the same reads the API performs.
  const [activitiesSnap, chatSnap] = await Promise.all([
    firestore.collection('activities').get(),
    rtdb.ref('activityChats').get(),
  ]);
  const chatVal = chatSnap.val() as Record<string, { messages?: Record<string, unknown> }> | null;
  const chatThreads = chatVal ? Object.keys(chatVal).length : 0;
  const chatMsgTotal = chatVal
    ? Object.values(chatVal).reduce((sum, t) => sum + Object.keys(t.messages ?? {}).length, 0)
    : 0;
  // Every cover must depict its own sport (collage fallback allowed).
  const urlSport = new Map<string, string>();
  for (const sc of SPORTS) {
    for (const local of sc.covers) {
      const url = coverUrlByFile.get(local);
      if (url) urlSport.set(url, sc.sport);
    }
  }
  let coverMismatch = 0;
  activitiesSnap.forEach((d) => {
    const x = d.data();
    if (x.coverImageUrl === fallbackCover) return;
    if (urlSport.get(x.coverImageUrl) !== x.sportType) {
      coverMismatch += 1;
      console.log(`COVER MISMATCH: ${d.id} (${x.sportType}) -> ${x.coverImageUrl}`);
    }
  });
  console.log(`VERIFY: cover mismatches=${coverMismatch}.`);
  console.log(
    `VERIFY: activities=${activitiesSnap.size} (paid=${stats.paid}, free=${stats.free}, ` +
      `instant-join=${stats.open}, approval=${stats.approval}), ` +
      `pendingRequests=${stats.joinRequests}, ` +
      `chatThreads=${chatThreads}, chatMessages=${chatMsgTotal}.`,
  );
  if (activitiesSnap.size !== TOTAL || chatThreads !== TOTAL || coverMismatch > 0) {
    throw new Error(
      `Verification failed: expected ${TOTAL} activities + ${TOTAL} chat threads + 0 cover mismatches.`,
    );
  }
  console.log('DONE: 100 Auckland activities seeded.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
