import { createClient } from "@supabase/supabase-js";
import type { Bootstrap, Detail, State, Settings, Stock } from "./types";
import { defaultSettings } from "./types";
export const local =
  import.meta.env.DEV || import.meta.env.VITE_LOCAL === "true";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = !local && url && key ? createClient(url, key) : null;

async function request<T>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(
      typeof data.detail === "string"
        ? data.detail
        : `请求失败 (${response.status})`,
    );
  }
  return response.json();
}
export async function bootstrap(): Promise<Bootstrap> {
  if (local) return request("/bootstrap");
  if (!supabase) throw new Error("线上服务尚未连接");
  const [
    { data: stocks, error: e1 },
    { data: states, error: e2 },
    { data: settings, error: e3 },
  ] = await Promise.all([
    supabase.from("stocks").select("summary"),
    supabase.from("watch_states").select("*"),
    supabase.from("user_settings").select("*").maybeSingle(),
  ]);
  if (e1 || e2 || e3) throw new Error((e1 || e2 || e3)!.message);
  return {
    stocks: (stocks || []).map((s) => {
      const stock = s.summary as Stock;
      return stock.next_session_due &&
        Date.now() >= Date.parse(stock.next_session_due)
        ? {
            ...stock,
            quality: "stale",
            expected_date: stock.next_session_date || stock.expected_date,
          }
        : stock;
    }),
    states: Object.fromEntries(
      (states || []).map((s) => [
        s.symbol,
        { ...s.data, revision: s.revision },
      ]),
    ),
    settings: settings
      ? { ...settings.data, revision: settings.revision }
      : defaultSettings,
    mode: "cloud",
    mail_configured: import.meta.env.VITE_MAIL_CONFIGURED === "true",
  };
}
export async function detail(symbol: string): Promise<Detail> {
  if (local) return request(`/stocks/${encodeURIComponent(symbol)}`);
  if (!supabase) throw new Error("线上服务尚未连接");
  const { data: stock, error } = await supabase
    .from("stocks")
    .select("detail_path")
    .eq("symbol", symbol)
    .single();
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage
    .from("market-data")
    .download(stock.detail_path);
  if (e2) throw e2;
  const text = stock.detail_path.endsWith(".gz")
    ? await new Response(
        data.stream().pipeThrough(new DecompressionStream("gzip")),
      ).text()
    : await data.text();
  return JSON.parse(text);
}
export async function saveState(symbol: string, state: State): Promise<State> {
  if (local)
    return request(`/states/${encodeURIComponent(symbol)}`, "PUT", state);
  const { revision, ...data } = state;
  const { data: result, error } = await supabase!.rpc("save_watch_state", {
    p_symbol: symbol,
    p_data: data,
    p_revision: revision,
  });
  if (error) throw new Error(error.message);
  return { ...result.data, revision: result.revision };
}
export async function saveSettings(settings: Settings): Promise<Settings> {
  if (local) return request("/settings", "PUT", settings);
  const { revision, ...data } = settings;
  const { data: result, error } = await supabase!.rpc("save_user_settings", {
    p_data: data,
    p_revision: revision,
  });
  if (error) throw new Error(error.message);
  return { ...result.data, revision: result.revision };
}
