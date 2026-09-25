export const PERIODS = ["overall", "7day", "1month", "3month", "6month", "12month"] as const;
export type Period = (typeof PERIODS)[number];

export interface TopTrack {
  rank: number;
  track: string;
  artist: string;
  playcount: number;
  url: string;
}

export interface TopTracksOptions {
  user: string;
  apiKey: string;
  limit: number;
  period: Period;
  fetchImpl?: typeof fetch;
}

interface TrackJson {
  name: string;
  playcount: string;
  url: string;
  artist: { name: string };
  "@attr": { rank: string };
}

interface TopTracksJson {
  toptracks?: {
    track: TrackJson[] | TrackJson;
    "@attr": { page: string; totalPages: string };
  };
  error?: number;
  message?: string;
}

const API_URL = "https://ws.audioscrobbler.com/2.0/";
const MAX_PAGE_SIZE = 1000;

export function mapTrack(json: TrackJson): TopTrack {
  return {
    rank: Number(json["@attr"].rank),
    track: json.name,
    artist: json.artist.name,
    playcount: Number(json.playcount),
    url: json.url,
  };
}

async function fetchPage(
  opts: TopTracksOptions,
  page: number,
  pageSize: number,
): Promise<{ tracks: TopTrack[]; totalPages: number }> {
  const params = new URLSearchParams({
    method: "user.gettoptracks",
    user: opts.user,
    period: opts.period,
    limit: String(pageSize),
    page: String(page),
    api_key: opts.apiKey,
    format: "json",
  });
  const res = await (opts.fetchImpl ?? fetch)(`${API_URL}?${params}`);
  const body = (await res.json()) as TopTracksJson;
  if (body.error !== undefined || !body.toptracks) {
    throw new Error(`Last.fm error ${body.error ?? res.status}: ${body.message ?? res.statusText}`);
  }
  // Last.fm returns a bare object instead of an array when a page has one track.
  const raw = body.toptracks.track;
  const list = Array.isArray(raw) ? raw : [raw];
  return {
    tracks: list.map(mapTrack),
    totalPages: Number(body.toptracks["@attr"].totalPages),
  };
}

export async function getTopTracks(opts: TopTracksOptions): Promise<TopTrack[]> {
  const pageSize = Math.min(opts.limit, MAX_PAGE_SIZE);
  const result: TopTrack[] = [];
  for (let page = 1; result.length < opts.limit; page++) {
    const { tracks, totalPages } = await fetchPage(opts, page, pageSize);
    result.push(...tracks);
    if (tracks.length === 0 || page >= totalPages) break;
  }
  return result.slice(0, opts.limit);
}
