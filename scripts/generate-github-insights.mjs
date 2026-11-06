import { writeFile } from "node:fs/promises";

const username = "saji-sis";
const token = process.env.GITHUB_TOKEN;
const headers = {
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function github(path) {
  const response = await fetch(`https://api.github.com${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${path}`);
  }
  return response.json();
}

const profile = await github(`/users/${username}`);
const repositories = await github(`/users/${username}/repos?per_page=100&sort=updated&type=owner`);
const originalRepos = repositories.filter((repo) => !repo.fork);
const totalStars = originalRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

const languageTotals = new Map();
await Promise.all(originalRepos.map(async (repo) => {
  try {
    const languages = await github(`/repos/${username}/${repo.name}/languages`);
    for (const [language, bytes] of Object.entries(languages)) {
      languageTotals.set(language, (languageTotals.get(language) ?? 0) + bytes);
    }
  } catch {
    // A single unavailable repository should not break the profile card.
  }
}));

const totalBytes = [...languageTotals.values()].reduce((sum, bytes) => sum + bytes, 0);
const palette = {
  TypeScript: "#3178C6",
  JavaScript: "#F0DB4F",
  HTML: "#E44D26",
  CSS: "#1572B6",
  PHP: "#777BB4",
  SCSS: "#CD6799",
  Shell: "#89E051",
  Blade: "#F05340",
  Vue: "#41B883",
  Python: "#3572A5",
  Java: "#B07219",
  Go: "#00ADD8",
};
const fallback = ["#E66A78", "#D6A0A8", "#B98B96", "#8E6674", "#C9B2B8", "#9AA4B2"];
const languages = [...languageTotals.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, bytes], index) => ({
    name,
    percent: totalBytes ? (bytes / totalBytes) * 100 : 0,
    color: palette[name] ?? fallback[index % fallback.length],
  }));

const esc = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
const cards = [
  { value: profile.public_repos, label: "PUBLIC REPOSITORIES" },
  { value: totalStars, label: "STARS EARNED" },
  { value: profile.followers, label: "FOLLOWERS" },
  { value: new Date(profile.created_at).getFullYear(), label: "ON GITHUB SINCE" },
];
const cardMarkup = cards.map((card, index) => {
  const x = 28 + index * 189.5;
  const delay = (index * 0.12).toFixed(2);
  return `
  <g class="card" style="animation-delay:${delay}s">
    <rect x="${x}" y="28" width="175.5" height="92" rx="12" fill="#18212A" stroke="#3A414A"/>
    <rect x="${x + 16}" y="28" width="36" height="3" rx="1.5" fill="#F06A78"/>
    <text x="${x + 16}" y="80" class="big" fill="#FFFFFF">${esc(card.value)}</text>
    <text x="${x + 16}" y="102" class="lbl" fill="#9AA4B2">${card.label}</text>
  </g>`;
}).join("");

const barX = 28;
const barY = 182;
const barW = 744;
let cursor = barX;
const barMarkup = languages.map((language) => {
  const width = (language.percent / 100) * barW;
  const rect = `<rect x="${cursor.toFixed(2)}" y="${barY}" width="${Math.max(width, 0).toFixed(2)}" height="12" fill="${language.color}"/>`;
  cursor += width;
  return rect;
}).join("");

const legendMarkup = languages.map((language, index) => {
  const col = index % 3;
  const row = Math.floor(index / 3);
  const x = 34 + col * 248;
  const y = 227 + row * 30;
  return `
  <circle cx="${x}" cy="${y - 5}" r="5" fill="${language.color}"/>
  <text x="${x + 14}" y="${y}" class="t" fill="#E6EDF3">${esc(language.name)}<tspan fill="#9AA4B2" dx="8">${language.percent.toFixed(1)}%</tspan></text>`;
}).join("");

const emptyLanguage = languages.length === 0
  ? '<text x="28" y="228" class="t" fill="#9AA4B2">No public language data available yet.</text>'
  : "";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="294" viewBox="0 0 800 294" role="img" aria-label="GitHub insights for ${username}">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#0D1117"/>
    <stop offset="1" stop-color="#17232E"/>
  </linearGradient>
  <clipPath id="bar"><rect x="28" y="182" width="744" height="12" rx="6"/></clipPath>
  <style>
    .t{font-family:'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace;font-size:14px}
    .lbl{font-family:'JetBrains Mono','Fira Code',Consolas,'Courier New',monospace;font-size:10px;letter-spacing:1.5px}
    .big{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;font-weight:800;font-size:34px}
    .card{opacity:0;animation:fade .55s ease forwards}
    .grow{transform-origin:left center;animation:grow .9s ease .55s both}
    @keyframes fade{to{opacity:1}}
    @keyframes grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
    @media(prefers-reduced-motion:reduce){.card,.grow{animation:none!important;opacity:1!important;transform:none!important}}
  </style>
</defs>
<rect x="1" y="1" width="798" height="292" rx="16" fill="url(#bg)" stroke="#30363D"/>
${cardMarkup}
<text x="28" y="166" class="t"><tspan fill="#F06A78">//</tspan> <tspan fill="#9AA4B2">languages</tspan></text>
<rect x="28" y="182" width="744" height="12" rx="6" fill="#161B22"/>
<g clip-path="url(#bar)" class="grow">${barMarkup}</g>
${legendMarkup}
${emptyLanguage}
<text x="772" y="278" text-anchor="end" font-family="Consolas,monospace" font-size="9" fill="#66717E">UPDATED AUTOMATICALLY VIA GITHUB ACTIONS</text>
</svg>`;

await writeFile("assets/github-insights.svg", svg, "utf8");
console.log("Generated assets/github-insights.svg");
