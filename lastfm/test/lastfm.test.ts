import { describe, expect, it } from "vitest";
import { getTopTracks } from "../src/lastfm.js";
import { toCsv } from "../src/csv.js";

function track(rank: number) {
  return {
    name: `Song ${rank}`,
    playcount: String(1000 - rank),
    url: `https://www.last.fm/music/a/_/song-${rank}`,
    artist: { name: "Artist" },
    "@attr": { rank: String(rank) },
  };
}

function fakeFetch(pages: unknown[][], urls: string[] = []): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    const page = Number(url.searchParams.get("page"));
    const body = {
      toptracks: {
        track: pages[page - 1] ?? [],
        "@attr": { page: String(page), totalPages: String(pages.length) },
      },
    };
    return new Response(JSON.stringify(body));
  }) as typeof fetch;
}

describe("getTopTracks", () => {
  it("maps tracks and sends the expected query", async () => {
    const urls: string[] = [];
    const tracks = await getTopTracks({
      user: "whocasty",
      apiKey: "key",
      limit: 2,
      period: "7day",
      fetchImpl: fakeFetch([[track(1), track(2)]], urls),
    });
    expect(tracks).toEqual([
      { rank: 1, track: "Song 1", artist: "Artist", playcount: 999, url: "https://www.last.fm/music/a/_/song-1" },
      { rank: 2, track: "Song 2", artist: "Artist", playcount: 998, url: "https://www.last.fm/music/a/_/song-2" },
    ]);
    const params = new URL(urls[0]).searchParams;
    expect(params.get("method")).toBe("user.gettoptracks");
    expect(params.get("user")).toBe("whocasty");
    expect(params.get("period")).toBe("7day");
    expect(params.get("limit")).toBe("2");
  });

  it("stops when the user has fewer tracks than the limit", async () => {
    const tracks = await getTopTracks({
      user: "u",
      apiKey: "key",
      limit: 100,
      period: "overall",
      fetchImpl: fakeFetch([[track(1), track(2), track(3)]]),
    });
    expect(tracks).toHaveLength(3);
  });

  it("accepts a single track returned as an object", async () => {
    const tracks = await getTopTracks({
      user: "u",
      apiKey: "key",
      limit: 1,
      period: "overall",
      fetchImpl: fakeFetch([track(1) as unknown as unknown[]]),
    });
    expect(tracks.map((t) => t.rank)).toEqual([1]);
  });

  it("surfaces Last.fm API errors", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 6, message: "User not found" }), { status: 404 })) as typeof fetch;
    await expect(
      getTopTracks({ user: "nobody", apiKey: "key", limit: 10, period: "overall", fetchImpl }),
    ).rejects.toThrow("Last.fm error 6: User not found");
  });
});

describe("toCsv", () => {
  it("writes a header and escapes commas and quotes", () => {
    const csv = toCsv([
      { rank: 1, track: 'Say "Hi", Now', artist: "A", playcount: 5, url: "https://x" },
    ]);
    expect(csv).toBe('rank,track,artist,playcount,url\n1,"Say ""Hi"", Now",A,5,https://x\n');
  });
});
