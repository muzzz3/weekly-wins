import Parser from 'rss-parser';

export interface WeatherData {
  temperature: number;
  unit: string;
  condition: string;
  conditionCode: number;
  windspeed: number;
  high: number;
  low: number;
  precipitationChance: number;
  location: string;
}

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
}

export type NewsCategory = 'top' | 'tech' | 'world' | 'science';

const WMO_CODES: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
  45: 'Foggy', 48: 'Icy fog',
  51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
  61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
  71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
  77: 'Snow grains',
  80: 'Slight showers', 81: 'Moderate showers', 82: 'Violent showers',
  85: 'Slight snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm w/ hail', 99: 'Thunderstorm w/ heavy hail',
};

const CATEGORY_FEEDS: Record<NewsCategory, Array<{ url: string; source: string }>> = {
  top: [
    { url: 'https://feeds.npr.org/1001/rss.xml', source: 'NPR' },
    { url: 'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml', source: 'NYT' },
    { url: 'https://feeds.reuters.com/reuters/topNews', source: 'Reuters' },
  ],
  tech: [
    { url: 'https://www.theverge.com/rss/index.xml', source: 'The Verge' },
    { url: 'https://feeds.arstechnica.com/arstechnica/index', source: 'Ars Technica' },
    { url: 'https://techcrunch.com/feed/', source: 'TechCrunch' },
  ],
  world: [
    { url: 'https://feeds.bbci.co.uk/news/world/rss.xml', source: 'BBC' },
    { url: 'https://feeds.reuters.com/reuters/worldNews', source: 'Reuters' },
  ],
  science: [
    { url: 'https://www.sciencedaily.com/rss/all.xml', source: 'Science Daily' },
    { url: 'https://www.nasa.gov/rss/dyn/breaking_news.rss', source: 'NASA' },
  ],
};

// In-memory caches
let locationCache: { lat: number; lon: number; city: string } | null = null;
let weatherCache: { data: WeatherData; ts: number } | null = null;
const newsCache = new Map<string, { data: NewsArticle[]; ts: number }>();
const WEATHER_TTL = 15 * 60 * 1000;
const NEWS_TTL = 30 * 60 * 1000;

async function cityFromCoords(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
      { signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'weekly-wins-app' } }
    );
    const json = await res.json() as { address?: { city?: string; town?: string; village?: string } };
    return json.address?.city ?? json.address?.town ?? json.address?.village ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export async function fetchWeather(lat?: number, lon?: number, unit: 'F' | 'C' = 'F'): Promise<WeatherData> {
  // If caller supplies coords or unit changed, bypass cache
  if (lat !== undefined && lon !== undefined) {
    weatherCache = null;
    locationCache = null;
  }
  if (weatherCache && weatherCache.data.unit !== (unit === 'F' ? '°F' : '°C')) {
    weatherCache = null;
  }

  if (weatherCache && Date.now() - weatherCache.ts < WEATHER_TTL) return weatherCache.data;

  let resolvedLat = lat;
  let resolvedLon = lon;
  let city = 'Unknown';

  if (resolvedLat === undefined || resolvedLon === undefined) {
    // Fall back to IP geolocation
    if (!locationCache) {
      try {
        const res = await fetch('http://ip-api.com/json/?fields=lat,lon,city,status', { signal: AbortSignal.timeout(5000) });
        const json = await res.json() as { lat: number; lon: number; city: string; status: string };
        if (json.status === 'success') locationCache = { lat: json.lat, lon: json.lon, city: json.city };
      } catch {
        locationCache = { lat: 32.7157, lon: -117.1611, city: 'San Diego' };
      }
    }
    resolvedLat = locationCache!.lat;
    resolvedLon = locationCache!.lon;
    city = locationCache!.city;
  } else {
    city = await cityFromCoords(resolvedLat, resolvedLon);
    locationCache = { lat: resolvedLat, lon: resolvedLon, city };
  }
  const unitParam = unit === 'F' ? 'fahrenheit' : 'celsius';
  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${resolvedLat}&longitude=${resolvedLon}` +
    `&current=temperature_2m,weather_code,wind_speed_10m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&timezone=auto&forecast_days=1&temperature_unit=${unitParam}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Weather API error ${res.status}: ${body}`);
  }
  const json = await res.json() as any;

  const code: number = json.current.weather_code ?? json.current.weathercode ?? 0;
  const data: WeatherData = {
    temperature: Math.round(json.current.temperature_2m),
    unit: unit === 'F' ? '°F' : '°C',
    condition: WMO_CODES[code] ?? 'Unknown',
    conditionCode: code,
    windspeed: Math.round(json.current.wind_speed_10m ?? json.current.windspeed_10m ?? 0),
    high: Math.round(json.daily.temperature_2m_max[0]),
    low: Math.round(json.daily.temperature_2m_min[0]),
    precipitationChance: json.daily.precipitation_probability_max[0] ?? 0,
    location: city,
  };

  weatherCache = { data, ts: Date.now() };
  return data;
}


const rssParser = new Parser({ timeout: 8000 });

async function fetchFeed(url: string, source: string): Promise<NewsArticle[]> {
  try {
    const feed = await rssParser.parseURL(url);
    return feed.items.slice(0, 5).map((item) => ({
      title: item.title ?? '',
      link: item.link ?? '',
      source,
    }));
  } catch {
    return [];
  }
}

export async function fetchNews(category: NewsCategory): Promise<NewsArticle[]> {
  const cached = newsCache.get(category);
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data;

  const feeds = CATEGORY_FEEDS[category];
  const results = await Promise.allSettled(feeds.map((f) => fetchFeed(f.url, f.source)));
  const articles = results
    .filter((r): r is PromiseFulfilledResult<NewsArticle[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)
    .slice(0, 12);

  newsCache.set(category, { data: articles, ts: Date.now() });
  return articles;
}

export async function fetchAllNews(): Promise<Record<NewsCategory, NewsArticle[]>> {
  const categories: NewsCategory[] = ['top', 'tech', 'world', 'science'];
  const results = await Promise.allSettled(categories.map((c) => fetchNews(c)));
  return Object.fromEntries(
    categories.map((c, i) => [
      c,
      results[i].status === 'fulfilled'
        ? (results[i] as PromiseFulfilledResult<NewsArticle[]>).value
        : [],
    ])
  ) as Record<NewsCategory, NewsArticle[]>;
}
