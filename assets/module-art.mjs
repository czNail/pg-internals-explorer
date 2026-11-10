// Each illustration uses the module's own silhouette and the map's color palette.
const art = {
  client: `
    <rect x="10" y="11" width="60" height="43" rx="8" fill="var(--art-light)"/>
    <path d="M10 20a9 9 0 0 1 9-9h42a9 9 0 0 1 9 9v4H10Z" fill="var(--art-mid)"/>
    <circle cx="20" cy="17.5" r="1.5" fill="var(--art-ink)"/><circle cx="26" cy="17.5" r="1.5" fill="var(--art-ink)"/>
    <path d="m25 31 6 5-6 5m13 0h13" fill="none" stroke="var(--art-ink)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  backend: `
    <path d="M27 5v11m13-11v11m13-11v11M27 48v11m13-11v11m13-11v11M11 19h10m-10 13h10m-10 13h10m38-26h10M59 32h10M59 45h10" stroke="var(--art-mid)" stroke-width="3" stroke-linecap="round"/>
    <rect x="18" y="10" width="44" height="44" rx="10" fill="var(--art-light)"/>
    <rect x="27" y="19" width="26" height="26" rx="6" fill="var(--art-ink)"/>
    <path d="m42 24-7 10h5l-2 6 7-10h-5Z" fill="#fff"/>
  `,
  snapshot: `
    <path d="m13 37 27-14 27 14a4 4 0 0 1 0 7L42 58a5 5 0 0 1-4 0L13 44a4 4 0 0 1 0-7Z" fill="var(--art-mid)"/>
    <path d="m13 27 25-13a5 5 0 0 1 4 0l25 13a4 4 0 0 1 0 7L42 48a5 5 0 0 1-4 0L13 34a4 4 0 0 1 0-7Z" fill="var(--art-light)"/>
    <circle cx="43" cy="28" r="10" fill="#fff"/>
    <path d="M43 23v5l4 2" fill="none" stroke="var(--art-ink)" stroke-width="2" stroke-linecap="round"/>
    <path d="M16 32 38 44m14-5 12-6" stroke="var(--art-mid)" stroke-width="1.3" stroke-linecap="round"/>
  `,
  buffers: `
    <rect x="7" y="11" width="66" height="43" rx="8" fill="var(--art-light)"/>
    <rect x="13" y="17" width="16" height="13" rx="3" fill="var(--art-ink)"/>
    <rect x="32" y="17" width="16" height="13" rx="3" fill="var(--art-mid)"/>
    <rect x="51" y="17" width="16" height="13" rx="3" fill="#fff"/>
    <rect x="13" y="34" width="16" height="13" rx="3" fill="var(--art-mid)"/>
    <rect x="32" y="34" width="16" height="13" rx="3" fill="#fff"/>
    <rect x="51" y="34" width="16" height="13" rx="3" fill="var(--art-mid)"/>
    <path d="M18 23.5h6" stroke="white" stroke-width="1.6" stroke-linecap="round"/>
  `,
  heap: `
    <path d="M19 7h28l13 13v32a6 6 0 0 1-6 6H19a6 6 0 0 1-6-6V13a6 6 0 0 1 6-6Z" fill="var(--art-light)"/>
    <path d="M47 7v10a3 3 0 0 0 3 3h10Z" fill="var(--art-mid)"/>
    <rect x="22" y="17" width="16" height="5" rx="2.5" fill="var(--art-ink)"/>
    <path d="M22 30h3m6 0h17M22 38h3m6 0h17M22 46h3m6 0h17" stroke="var(--art-ink)" stroke-width="2" stroke-linecap="round"/>
    <rect x="53" y="41" width="16" height="13" rx="3.5" fill="var(--art-ink)"/>
    <path d="M57 47.5h8m-4-3v6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
  `,
  wal: `
    <rect x="9" y="13" width="57" height="11" rx="4" fill="var(--art-light)"/>
    <rect x="13" y="27" width="57" height="11" rx="4" fill="var(--art-mid)"/>
    <rect x="17" y="41" width="57" height="11" rx="4" fill="var(--art-ink)"/>
    <path d="M16 18.5h6m5 0h22M20 32.5h6m5 0h22" stroke="var(--art-ink)" stroke-width="1.55" stroke-linecap="round"/>
    <path d="M24 46.5h6m5 0h22" stroke="#fff" stroke-width="1.55" stroke-linecap="round"/>
  `,
  relation: `
    <path d="M13 17h54v28c0 7-12 13-27 13s-27-6-27-13Z" fill="var(--art-light)"/>
    <path d="M13 28c0 6 12 11 27 11s27-5 27-11M13 38c0 6 12 11 27 11s27-5 27-11" stroke="var(--art-ink)" stroke-opacity=".58" stroke-width="1.5" fill="none"/>
    <ellipse cx="40" cy="17" rx="27" ry="11" fill="var(--art-mid)"/>
    <ellipse cx="40" cy="17" rx="15" ry="4" fill="none" stroke="var(--art-ink)" stroke-opacity=".65" stroke-width="1.4"/>
    <circle cx="58" cy="43" r="2" fill="var(--art-ink)"/>
  `,
  checkpointer: `
    <circle cx="37" cy="32" r="24" fill="var(--art-light)"/>
    <path d="M37 12a20 20 0 0 1 19 13M37 52a20 20 0 0 1-20-20" fill="none" stroke="var(--art-mid)" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M37 19v13l8 5" fill="none" stroke="var(--art-ink)" stroke-width="2.6" stroke-linecap="round"/>
    <circle cx="37" cy="32" r="3" fill="var(--art-ink)"/>
    <circle cx="59" cy="44" r="12" fill="var(--art-ink)"/>
    <path d="m54 44 3.5 3.5L64 41" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  `,
  walfile: `
    <path d="M10 18a5 5 0 0 1 5-5h18l6 6h25a6 6 0 0 1 6 6v23H10Z" fill="var(--art-mid)"/>
    <rect x="26" y="23" width="30" height="24" rx="3" fill="#fff"/>
    <path d="M32 29h18m-18 5h14" stroke="var(--art-ink)" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M15 37h52a4 4 0 0 1 4 4l-4 10a5 5 0 0 1-5 4H16a5 5 0 0 1-5-4L8 43a5 5 0 0 1 7-6Z" fill="var(--art-light)"/>
    <path d="M34 46h12" stroke="var(--art-ink)" stroke-width="2" stroke-linecap="round"/>
  `,
  vacuum: `
    <path d="M14 43h46v10a5 5 0 0 1-5 5H19a5 5 0 0 1-5-5Z" fill="var(--art-light)"/>
    <path d="M21 43v-9h32v9M35 34l20-23" stroke="var(--art-mid)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    <path d="M23 51h9m7 0h13M60 24l5-5m-1 13h7" stroke="var(--art-ink)" stroke-width="2" stroke-linecap="round"/>
  `
};

export const labArt = {buffers:'buffers', wal:'wal', mvcc:'snapshot', hot:'heap', vacuum:'vacuum'};

export function moduleArt(id) {
  return `<svg viewBox="0 0 80 64" aria-hidden="true" focusable="false">${art[id]}</svg>`;
}
