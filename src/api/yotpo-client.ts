const YOTPO_API_BASE = "https://api.yotpo.com";

export async function fetchBadges(): Promise<unknown> {
  const response = await fetch(`${YOTPO_API_BASE}/badges`);

  if (!response.ok) {
    throw new Error(`Yotpo API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
