#!/usr/bin/env node
import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { getTopTracks, PERIODS, type Period } from "./lastfm.js";
import { toCsv } from "./csv.js";

const USAGE = `Usage: lastfm-top <user> [--limit 100] [--period overall] [--out top.csv]

Exports a Last.fm user's most played tracks as CSV.
Requires the LASTFM_API_KEY environment variable.

Periods: ${PERIODS.join(", ")}`;

function fail(message: string): never {
  console.error(`Error: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      limit: { type: "string", default: "100" },
      period: { type: "string", default: "overall" },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const user = positionals[0];
  if (!user) fail(`missing <user>.\n\n${USAGE}`);

  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1) fail("--limit must be a positive integer.");

  const period = values.period as Period;
  if (!PERIODS.includes(period)) fail(`--period must be one of: ${PERIODS.join(", ")}.`);

  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) fail("LASTFM_API_KEY is not set. Get one at https://www.last.fm/api/account/create.");

  const tracks = await getTopTracks({ user, apiKey, limit, period });
  const csv = toCsv(tracks);

  if (values.out) {
    writeFileSync(values.out, csv, "utf-8");
    console.error(`Wrote ${tracks.length} tracks to ${values.out}.`);
  } else {
    process.stdout.write(csv);
  }
}

main().catch((err) => fail(err instanceof Error ? err.message : String(err)));
