import { fetch, ResponseType } from '@tauri-apps/api/http';
import { HTMLElement, Node, parse } from 'node-html-parser';

function trim(s: string, c: string) {
  while (s.endsWith(c)) s = s.slice(0, s.length - c.length);
  while (s.startsWith(c)) s = s.slice(c.length);
  return s;
}

function subWhitespace(text: string) {
  return text.replaceAll(/\s+/g, ' ');
}

function getString(tag: HTMLElement): string {
  const a = tag.querySelector('a');
  if (a) {
    tag = a;
    let href = tag.getAttribute('href');
    if (href && !href.includes('javascript:')) {
      if (!href.includes('http')) href = 'https://www.ccappraiser.com/' + encodeURI(href);
      return subWhitespace(`${getString(tag)} (${href})`);
    }
  }
  return subWhitespace(trim(findStrings(tag)[0].textContent.trim(), ':'));
}

function getStringContents(tag: HTMLElement) {
  const ret: string[] = [];
  findStrings(tag).forEach((node) => {
    let text = node.textContent;
    if (text) {
      text = subWhitespace(text.trim());
      if (text) ret.push(text);
    }
  });
  return ret;
}

function findStrings(tag: HTMLElement) {
  let ret: Node[] = [];
  for (const node of tag.childNodes) {
    if (node instanceof HTMLElement) ret = ret.concat(findStrings(node));
    else ret.push(node);
  }
  return ret;
}

const mainCell = 'div:is(.w3-cell, .w3-container):has(> h2)';

const mainCellContent = '.w3-border:not(:has(div.w3-row))';

function readCell(cell: HTMLElement, info: Record<string, unknown>) {
  const header = cell.childNodes.find(
    (node) => node instanceof HTMLElement && node.tagName === 'H2'
  ) as HTMLElement;
  const contents = cell.querySelectorAll(mainCellContent);
  if (!contents[0].classList.contains('w3-row')) {
    const content = contents[0];
    if (content.localName === 'table') readTable(content, info, getString(header));
    else info[getString(header)] = getStringContents(content);
  } else {
    const rows: Record<string, string[]> = {};
    for (const row of contents) {
      const title = row.querySelector('strong')!;
      const content = row.querySelector(':has(strong) ~ div')!;
      rows[getString(title)] = getStringContents(content);
    }
    info[getString(header)] = rows;
  }
}

const mainTable = 'table:has(caption.blockcaption)';

function readTable(tag: HTMLElement, info: Record<string, unknown>, caption?: string) {
  if (!caption) caption = getString(tag.querySelector('caption')!);
  const rows = tag.querySelectorAll('tr');
  const keys = rows[0].querySelectorAll('strong');
  if (rows[1].querySelector('strong')) {
    const table: Record<string, Record<string, string>> = {};
    for (const row of rows) {
      if (row === rows[0]) continue;
      const title = getString(row.querySelector('strong')!);
      const rowInfo: Record<string, string> = {};
      const values = row.querySelectorAll('td');
      for (let i = 1; i < values.length; i++) {
        const value = values[i];
        rowInfo[getString(keys[i])] = getString(value);
      }
      table[title] = rowInfo;
    }
    info[caption] = table;
  } else {
    const table = [];
    for (const row of rows) {
      const rowInfo: Record<string, string> = {};
      const values = row.querySelectorAll('td');
      for (let i = 0; i < values.length; i++) {
        const value = values[i];
        rowInfo[getString(keys[i])] = getString(value);
      }
      table.push(rowInfo);
    }
    info[caption] = table;
  }
}

const loneHeader = 'h2:has(~ div.w3-cell-row)';

const loneHeaderSibling = 'h2 ~ div.w3-cell-row';

function readLoneHeader(header: HTMLElement, info: Record<string, unknown>) {
  const sibling = header.parentNode.querySelector(loneHeaderSibling)!;
  const contents = sibling.querySelectorAll('div.w3-cell');
  const contentInfo: Record<string, string> = {};
  for (const content of contents) {
    const children = findStrings(content);
    const strings: string[] = [];
    for (const child of children) {
      const string = subWhitespace(trim(child.textContent.trim(), ':'));
      if (string) strings.push(string);
    }
    contentInfo[strings[0]] = strings[1];
  }
  info[getString(header)] = contentInfo;
}

export async function getParcelInfo(parcel: string) {
  const url = `https://www.ccappraiser.com/Show_parcel.asp?acct=${parcel}&gen=T&tax=T&bld=T&oth=T&sal=T&lnd=T&leg=T`;

  const response = await fetch(url, { method: 'GET', responseType: ResponseType.Text });

  const root = parse(String(response.data));

  const info: Record<string, unknown> = { 'Parcel ID': parcel };

  const cells = root.querySelectorAll(mainCell);
  console.debug(cells);
  for (const cell of cells) readCell(cell, info);

  const tables = root.querySelectorAll(mainTable);
  console.debug(tables);
  for (const table of tables) readTable(table, info);

  // just legal description
  const header = root.querySelector(loneHeader);
  console.debug(header);
  if (header) readLoneHeader(header, info);

  console.log(info);

  return info;
}

export type AddressInfo = {
  address: string;
  score: number;
  mapsLink: string;
  parcel: string;
  info: Record<string, unknown>;
};

const originShift = (2 * Math.PI * 6378137) / 2;

// Converts XY point from Spherical Mercator EPSG:900913 to lat/lon in WGS84 Datum
function metersToLL(x: number, y: number) {
  const lon = (x / originShift) * 180;
  let lat = (y / originShift) * 180;

  lat = (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
  return [lat, lon];
}

function getMapsLink(x: number, y: number) {
  const [lat, lon] = metersToLL(x, y);
  return `https://maps.google.com/?q=${lat}+${lon}`;
}

async function processCandidate(
  candidate: Record<string, unknown>,
  duplicates: Set<string>
): Promise<AddressInfo | undefined> {
  const attrs = candidate['attributes'] as Record<string, unknown>;
  const parcel = attrs['User_fld'] as string;

  if (duplicates.has(parcel)) return undefined;
  duplicates.add(parcel);

  const location = candidate['location'] as Record<string, number>;
  const mapsLink = getMapsLink(location['x'], location['y']);

  const info = await getParcelInfo(parcel);

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    address: (info as any)['Property Location']['Property Address'][0] as string,
    score: attrs['Score'] as number,
    mapsLink,
    parcel,
    info,
  };
}

export async function searchAddress(address: string) {
  const url =
    'https://agis.charlottecountyfl.gov/arcgis/rest/services/Locators/Charlotte_Composite_Loc/GeocodeServer/findAddressCandidates';

  const baseParams = new URLSearchParams({
    f: 'json',
    outSR: '{"wkid": 102100}',
    outFields: '*',
    maxLocations: '25', // option to load more?
    SingleLine: address,
  });

  const response = await fetch(`${url}?${baseParams.toString()}`);

  const respJson = response.data as Record<string, unknown>;
  const candidates = respJson['candidates'] as Record<string, unknown>[];
  const duplicates = new Set<string>();

  const details = await Promise.all(
    candidates.map((candidate) => processCandidate(candidate, duplicates))
  );
  return details
    .filter((address) => address)
    .sort((a1, a2) => a1!.score - a2!.score) as AddressInfo[];
}
