import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Search,
  Settings2,
  ArrowUpRight,
  ArrowDownRight,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Mail,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  NotebookPen,
  Download,
  LogOut,
  Clock3,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import * as api from "./api";
import type {
  Bootstrap,
  Detail,
  Stock,
  State,
  Settings,
  Position,
} from "./types";
import { blankState } from "./types";
import Chart from "./Chart";

const number = (v: number | null | undefined, d = 2) =>
  v == null
    ? "—"
    : v.toLocaleString("en-US", {
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      });
const statusNames: Record<string, string> = {
  ok: "数据已确认",
  partial: "历史待核验",
  pending: "信号待核验",
  stale: "等待行情更新",
  unavailable: "尚无可用行情",
};
const eventNames: Record<string, string> = {
  start: "三连阴 · 开始计数",
  reset: "再次三连阴 · 重新计数",
  approaching: "第8日 · 临近观察",
  day10: "第10日 · 待你判断",
  review: "转折后辅助复核",
};
function currentStatus(s: Stock, state: State) {
  return state.status === "ignore" && state.cycle !== s.cycle
    ? "none"
    : state.status;
}
function isFresh(s: Stock) {
  return (
    s.last_date === s.expected_date &&
    s.quality !== "pending" &&
    s.quality !== "unavailable"
  );
}
function isNew(s: Stock) {
  return (
    isFresh(s) &&
    s.latest_event?.date === s.last_date &&
    ["start", "reset"].includes(s.latest_event.kind)
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-inner">
        <div className="dialog-title">
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="关闭">
            <X size={19} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="welcome">
      <div className="brand">
        <span className="brand-mark">日</span>日序<span>STOCK OBSERVER</span>
      </div>
      <div className="login-copy">
        <small>每日收盘之后</small>
        <h1>
          给判断，
          <br />
          留一点时间。
        </h1>
        <p>港美股观察、连续阴跌计数与个人交易记录。</p>
        {api.supabase ? (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const { error } = await api.supabase!.auth.signInWithOtp({
                email,
                options: {
                  shouldCreateUser: false,
                  emailRedirectTo:
                    window.location.origin + window.location.pathname,
                },
              });
              setMessage(
                error ? error.message : "登录链接已发送，请查收邮箱。",
              );
              setBusy(false);
            }}
          >
            <label>
              登录邮箱
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? "正在发送…" : "发送登录链接"}
              <ArrowRight size={16} />
            </button>
            <p className="muted">仅已开通的个人账户可以访问行情与记录。</p>
          </form>
        ) : (
          <div className="setup-note">
            <ShieldCheck size={22} />
            <p>网站已就绪，私人数据服务尚未连接。</p>
            <span>
              部署完成后，这里将显示登录入口。行情与个人记录不会发布在公开页面中。
            </span>
          </div>
        )}
        <p role="status">{message}</p>
      </div>
      <div className="welcome-line" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(api.local);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [selected, setSelected] = useState(
    decodeURIComponent(location.hash.slice(1)) || "MSFT",
  );
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [market, setMarket] = useState("all");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState("desk");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [range, setRange] = useState(126);
  const [modal, setModal] = useState<
    null | "settings" | "position" | "note" | "indicators" | "audit"
  >(null);
  const [settingsDraft, setSettingsDraft] = useState<Settings | null>(null);
  const [note, setNote] = useState("");
  const [positionDraft, setPositionDraft] = useState<Position | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!api.supabase) return;
    api.supabase.auth
      .getSession()
      .then(({ data }) => setAuthenticated(!!data.session));
    const { data: sub } = api.supabase.auth.onAuthStateChange(
      (_event, session) => setAuthenticated(!!session),
    );
    return () => sub.subscription.unsubscribe();
  }, []);
  const load = async () => {
    try {
      const d = await api.bootstrap();
      setData(d);
      setLoadError("");
    } catch (e) {
      setLoadError((e as Error).message);
    }
  };
  useEffect(() => {
    if (!authenticated) return;
    void load();
    const timer = setInterval(() => void load(), 300000);
    return () => clearInterval(timer);
  }, [authenticated]);
  useEffect(() => {
    if (!authenticated || !data) return;
    let active = true;
    setDetail(null);
    api
      .detail(selected)
      .then((d) => {
        if (active) {
          setDetail(d);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (active) setLoadError(e.message);
      });
    return () => {
      active = false;
    };
  }, [selected, data?.stocks, authenticated]);
  useEffect(() => {
    const listener = () => {
      const s = decodeURIComponent(location.hash.slice(1));
      if (s) setSelected(s);
    };
    window.addEventListener("hashchange", listener);
    return () => window.removeEventListener("hashchange", listener);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  if (!authenticated) return <Login />;
  if (!data)
    return (
      <div className="loading-page">
        <span className="brand-mark">日</span>
        <p>{loadError || "正在打开观察台…"}</p>
        {loadError && <button onClick={() => void load()}>重新加载</button>}
      </div>
    );
  const stock = data.stocks.find((s) => s.symbol === selected);
  const state = data.states[selected] || blankState;
  const ignored = stock ? currentStatus(stock, state) === "ignore" : false;
  const filtered = data.stocks.filter((s) => {
    const st = data.states[s.symbol] || blankState;
    const status = currentStatus(s, st);
    if (market !== "all" && s.market !== market) return false;
    if (
      query &&
      !`${s.symbol} ${s.previous_symbol || ""} ${s.name} ${s.sector}`
        .toLowerCase()
        .includes(query.toLowerCase())
    )
      return false;
    if (filter === "new") return isNew(s) && !st.muted && status !== "ignore";
    if (filter === "due")
      return (
        !!s.day &&
        s.day >= 10 &&
        status === "none" &&
        st.position?.status !== "open"
      );
    if (filter === "observe") return status === "observe";
    if (filter === "bought") return st.position?.status === "open";
    if (filter === "ignored") return status === "ignore" || st.muted;
    return status !== "ignore" && !st.muted;
  });
  const newCount = data.stocks.filter(
    (s) =>
      isNew(s) &&
      currentStatus(s, data.states[s.symbol] || blankState) !== "ignore" &&
      !data.states[s.symbol]?.muted,
  ).length;
  const dueCount = data.stocks.filter(
    (s) =>
      s.day &&
      s.day >= 10 &&
      currentStatus(s, data.states[s.symbol] || blankState) === "none" &&
      data.states[s.symbol]?.position?.status !== "open",
  ).length;
  const pendingCount = data.stocks.filter(
    (s) =>
      s.pending_count > 0 ||
      ["pending", "stale", "unavailable"].includes(s.quality),
  ).length;
  const choose = (symbol: string) => {
    setSelected(symbol);
    location.hash = encodeURIComponent(symbol);
    setMobileDetail(true);
    setView("desk");
  };
  const save = async (patch: Partial<State>) => {
    setSaving(true);
    try {
      const value = await api.saveState(selected, { ...state, ...patch });
      setData((d) =>
        d ? { ...d, states: { ...d.states, [selected]: value } } : d,
      );
      setToast("记录已保存");
      setModal(null);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const saveSettings = async (settings: Settings, close = true) => {
    setSaving(true);
    try {
      const result = await api.saveSettings(settings);
      setData((d) => (d ? { ...d, settings: result } : d));
      setToast("设置已保存");
      if (close) setModal(null);
    } catch (e) {
      setToast((e as Error).message);
    } finally {
      setSaving(false);
    }
  };
  const openSettings = () => {
    setSettingsDraft({ ...data.settings });
    setModal("settings");
  };
  const step = (offset: number) => {
    const index = filtered.findIndex((s) => s.symbol === selected);
    const next = filtered[index + offset];
    if (next) choose(next.symbol);
  };
  const exportData = () => {
    if (!detail) return;
    const text =
      "Date,Open,High,Low,Close,Volume,Valid\n" +
      detail.daily
        .map((b) =>
          [b.time, b.open, b.high, b.low, b.close, b.volume, b.valid].join(","),
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected}-adjusted.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const marketDate = (m: string) =>
    data.stocks
      .filter((s) => s.market === m && s.last_date)
      .map((s) => s.last_date!)
      .sort()
      .at(-1) || "—";
  const recentEvents = detail?.signal.events.slice(-6).reverse() || [];
  return (
    <div className={`app ${mobileDetail ? "mobile-detail" : ""}`}>
      <header className="topbar">
        <a href="#MSFT" className="brand" onClick={() => choose("MSFT")}>
          <span className="brand-mark">日</span>日序<span>STOCK OBSERVER</span>
        </a>
        <nav>
          <button
            className={view === "desk" ? "active" : ""}
            onClick={() => setView("desk")}
          >
            观察台
          </button>
          <button
            className={view === "quality" ? "active" : ""}
            onClick={() => setView("quality")}
          >
            数据核验
            <span className="nav-dot" />
          </button>
        </nav>
        <div className="top-actions">
          <span className="close-only">
            <i />
            仅盘后确认
          </span>
          <button
            className="icon"
            aria-label="刷新数据视图"
            onClick={() => void load()}
          >
            <RefreshCw size={17} />
          </button>
          <button className="icon" aria-label="设置" onClick={openSettings}>
            <Settings2 size={18} />
          </button>
          {!api.local && (
            <button
              className="icon"
              aria-label="退出登录"
              onClick={() => void api.supabase?.auth.signOut()}
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </header>
      <div className="session-strip">
        <span>
          <Clock3 size={13} />
          港股 {marketDate("HK")} <span className="sep">/</span> 美股{" "}
          {marketDate("US")}
        </span>
        <span>
          {data.stocks.length} 只股票 <span className="sep">/</span>{" "}
          <b>{newCount}</b> 个最新信号 <span className="sep">/</span>{" "}
          <b>{dueCount}</b> 项待判断
        </span>
      </div>
      {view === "quality" ? (
        <main className="quality-page">
          <div className="section-heading">
            <div>
              <small>DATA QUALITY</small>
              <h1>每一根 K 线，都有来处。</h1>
              <p>
                {pendingCount}{" "}
                只股票存在历史待核验记录或更新事项；近期数据独立判断。
              </p>
            </div>
            <button onClick={() => setView("desk")}>
              返回观察台
              <ArrowRight size={16} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>股票</th>
                  <th>市场</th>
                  <th>最近行情</th>
                  <th>应更新至</th>
                  <th>已修正行</th>
                  <th>待核验行</th>
                  <th>状态</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {[...data.stocks]
                  .sort((a, b) => b.pending_count - a.pending_count)
                  .map((s) => (
                    <tr
                      key={s.symbol}
                      onClick={() => choose(s.symbol)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") choose(s.symbol);
                      }}
                    >
                      <td>
                        <strong>{s.symbol}</strong>
                        <small>{s.name}</small>
                      </td>
                      <td>{s.market === "HK" ? "港股" : "美股"}</td>
                      <td>{s.last_date || "—"}</td>
                      <td>{s.expected_date}</td>
                      <td>{s.repair_count}</td>
                      <td>{s.pending_count}</td>
                      <td>
                        <span className={`quality ${s.quality}`}>
                          {statusNames[s.quality]}
                        </span>
                      </td>
                      <td>
                        <ArrowUpRight size={16} />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </main>
      ) : (
        <div className="workspace">
          <aside className="watchlist">
            <div className="watch-heading">
              <h2>观察列表</h2>
              <span>{filtered.length}</span>
            </div>
            <div className="search">
              <Search size={15} />
              <input
                ref={search}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索股票、代码或行业"
                aria-label="搜索股票"
              />
              <kbd>/</kbd>
            </div>
            <div className="market-tabs">
              {[
                ["all", "全部市场"],
                ["US", "美股"],
                ["HK", "港股"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={market === v ? "selected" : ""}
                  onClick={() => setMarket(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="filter-select">
              <SlidersHorizontal size={14} />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                aria-label="观察状态筛选"
              >
                <option value="all">全部活跃观察</option>
                <option value="new">最新三连阴</option>
                <option value="due">第10日 · 待判断</option>
                <option value="observe">继续观察</option>
                <option value="bought">已买入</option>
                <option value="ignored">已忽略 / 暂停提醒</option>
              </select>
            </label>
            <div className="list-label">
              <span>股票 / 当前阶段</span>
              <span>收盘价</span>
            </div>
            <div className="stock-list">
              {filtered.map((s) => {
                const st = data.states[s.symbol] || blankState;
                return (
                  <button
                    key={s.symbol}
                    className={`stock-row ${selected === s.symbol ? "selected" : ""}`}
                    onClick={() => choose(s.symbol)}
                  >
                    <div className="stock-row-top">
                      <strong>{s.symbol}</strong>
                      <span className="stock-price">{number(s.close)}</span>
                    </div>
                    <div className="stock-row-name">
                      <span>{s.name}</span>
                      <span
                        className={
                          (s.change || 0) >= 0 ? "positive" : "negative"
                        }
                      >
                        {s.change == null
                          ? "—"
                          : `${s.change >= 0 ? "+" : ""}${number(s.change)}%`}
                      </span>
                    </div>
                    <div className="stock-row-meta">
                      <span
                        className={`mini-stage ${s.day === 1 ? "new" : ""}`}
                      >
                        {st.position?.status === "open"
                          ? "已买入"
                          : s.phase === "unknown"
                            ? "待核验"
                            : s.day
                              ? `第 ${s.day} 日`
                              : "等待三连阴"}
                      </span>
                      <span>
                        {s.market === "HK" ? "HK" : "US"}
                        {["stale", "pending", "unavailable"].includes(
                          s.quality,
                        ) && " · 数据待更新"}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!filtered.length && (
                <div className="empty-list">
                  没有符合条件的股票
                  <button
                    onClick={() => {
                      setQuery("");
                      setFilter("all");
                      setMarket("all");
                    }}
                  >
                    清除筛选
                  </button>
                </div>
              )}
            </div>
            <div className="list-footer">
              <ShieldCheck size={14} />
              <span>人工判断 · 自动记录</span>
            </div>
          </aside>
          <main className="main-workspace">
            <button
              className="mobile-back"
              onClick={() => setMobileDetail(false)}
            >
              <ChevronLeft size={16} />
              观察列表
            </button>
            {stock ? (
              <>
                <div className="stock-heading">
                  <div>
                    <div className="eyebrow">
                      {stock.market === "HK" ? "香港市场" : "美国市场"}
                      <span>/</span>
                      {stock.sector}
                    </div>
                    <h1>
                      {stock.name}
                      <span>{stock.symbol}</span>
                    </h1>
                    {stock.previous_symbol && (
                      <p className="alias">
                        原代码 {stock.previous_symbol} · 已更新证券映射
                      </p>
                    )}
                  </div>
                  <div className="headline-price">
                    <strong>{number(stock.close)}</strong>
                    <span
                      className={
                        (stock.change || 0) >= 0 ? "positive" : "negative"
                      }
                    >
                      {(stock.change || 0) >= 0 ? (
                        <ArrowUpRight size={15} />
                      ) : (
                        <ArrowDownRight size={15} />
                      )}{" "}
                      {stock.change == null
                        ? "—"
                        : `${stock.change >= 0 ? "+" : ""}${number(stock.change)}%`}
                      <em>{stock.currency}</em>
                    </span>
                  </div>
                </div>
                <div className="chart-toolbar">
                  <div className="period-tabs">
                    {(
                      [
                        ["daily", "日 K"],
                        ["weekly", "周 K"],
                        ["monthly", "月 K"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        className={period === value ? "selected" : ""}
                        onClick={() => setPeriod(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="chart-tools">
                    <button onClick={() => setModal("indicators")}>
                      <SlidersHorizontal size={14} />
                      指标
                    </button>
                    <button
                      className="icon"
                      onClick={exportData}
                      aria-label="导出当前股票日线"
                    >
                      <Download size={15} />
                    </button>
                    <span className="toolbar-divider" />
                    <button
                      className="icon"
                      aria-label="上一只股票"
                      onClick={() => step(-1)}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button
                      className="icon"
                      aria-label="下一只股票"
                      onClick={() => step(1)}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                {["stale", "pending", "unavailable"].includes(
                  stock.quality,
                ) && (
                  <div className="data-warning">
                    <Clock3 size={14} />
                    {statusNames[stock.quality]}。当前计数截至{" "}
                    {stock.last_date || "—"}，应更新至 {stock.expected_date}。
                  </div>
                )}
                {detail?.daily.some((b) => b.valid) ? (
                  <Chart
                    detail={detail}
                    period={period}
                    settings={data.settings}
                    state={state}
                    range={range}
                  />
                ) : (
                  <div className="chart-loading">
                    {loadError ||
                      (detail
                        ? "尚无可绘制的有效日线，股票仍保留在观察列表。"
                        : "正在加载 K 线…")}
                  </div>
                )}
                <div className="range-row">
                  <div>
                    {[
                      [63, "3个月"],
                      [126, "6个月"],
                      [252, "1年"],
                      [756, "3年"],
                      [3000, "全部"],
                    ].map(([v, label]) => (
                      <button
                        key={v}
                        className={range === v ? "selected" : ""}
                        onClick={() => setRange(Number(v))}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <select
                    aria-label="副图指标"
                    value={data.settings.oscillator}
                    disabled={saving}
                    onChange={(e) =>
                      void saveSettings({
                        ...data.settings,
                        oscillator: e.target.value as Settings["oscillator"],
                      })
                    }
                  >
                    <option value="volume">成交量</option>
                    <option value="macd">MACD</option>
                    <option value="rsi">RSI</option>
                    <option value="atr">ATR</option>
                    <option value="kdj">KDJ</option>
                  </select>
                </div>
                <section className="event-section">
                  <div className="section-title">
                    <h2>观察轨迹</h2>
                    <span>连续阴跌再次出现时，从最新一天重新计数</span>
                  </div>
                  <div className="event-list">
                    {recentEvents.length ? (
                      recentEvents.map((e, i) => (
                        <div key={`${e.date}-${e.kind}`} className="event-row">
                          <span
                            className={`event-dot ${i === 0 ? "latest" : ""}`}
                          />
                          <time>{e.date}</time>
                          <span>{eventNames[e.kind]}</span>
                          {e.kind === "reset" && (
                            <small>原起点 {e.previous_anchor}</small>
                          )}
                        </div>
                      ))
                    ) : (
                      <p className="muted">有效数据区间内尚无三连阴记录。</p>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="chart-loading">请选择列表中的股票。</div>
            )}
          </main>
          <aside className="inspector">
            {stock && (
              <>
                <div className="inspector-label">
                  <span>当前观察</span>
                  <span className="confirmed">
                    <i />
                    {isFresh(stock) ? "盘后已确认" : "待更新 / 核验"}
                  </span>
                </div>
                <div className="day-display">
                  <span>{stock.day ?? "—"}</span>
                  <div>
                    <strong>{stock.day ? "交易日" : "等待信号"}</strong>
                    <small>
                      {stock.anchor
                        ? `起点 ${stock.anchor}`
                        : "寻找连续三个阴跌日"}
                    </small>
                  </div>
                </div>
                <div
                  className="day-track"
                  aria-label={`当前第${stock.day ?? 0}日`}
                >
                  {Array.from({ length: 10 }, (_, i) => (
                    <span
                      key={i}
                      className={stock.day && stock.day > i ? "filled" : ""}
                    />
                  ))}
                </div>
                <p className="stage-copy">
                  {stock.phase === "unknown"
                    ? "存在未确认日线，补齐后重新判断。"
                    : ignored
                      ? "本周期已忽略。新周期仍可重新提醒。"
                      : state.position?.status === "open"
                        ? "已记录买入。后续新信号不会覆盖持仓。"
                        : state.status === "observe"
                          ? "继续观察中，行情与计数会持续更新。"
                          : stock.day && stock.day >= 10
                            ? "已到观察位置，接下来由你判断。"
                            : "等价格走出来，再作判断。"}
                </p>
                <div className="decision-actions">
                  <button
                    className="primary"
                    disabled={saving || !stock.cycle}
                    onClick={() =>
                      void save({ status: "observe", cycle: stock.cycle })
                    }
                  >
                    {state.status === "observe" ? (
                      <Check size={16} />
                    ) : (
                      <Clock3 size={16} />
                    )}
                    继续观察
                  </button>
                  <div>
                    <button
                      disabled={saving}
                      onClick={() => {
                        setPositionDraft(
                          state.position || {
                            status: "open",
                            buy_date:
                              stock.last_date ||
                              new Date().toISOString().slice(0, 10),
                            buy_price: stock.close || 0,
                            quantity: null,
                          },
                        );
                        setModal("position");
                      }}
                    >
                      {state.position?.status === "open"
                        ? "管理持仓"
                        : "已买入"}
                    </button>
                    <button
                      disabled={saving || !stock.cycle}
                      onClick={() =>
                        void save({
                          status: ignored ? "none" : "ignore",
                          cycle: stock.cycle,
                        })
                      }
                    >
                      {ignored ? "恢复本周期" : "忽略本周期"}
                    </button>
                  </div>
                </div>
                {state.position && (
                  <div className="position-summary">
                    <span>
                      {state.position.status === "open"
                        ? "持仓记录"
                        : "已结束持仓"}
                    </span>
                    <strong>
                      {number(state.position.buy_price)}{" "}
                      <small>{stock.currency}</small>
                    </strong>
                    <small>
                      {state.position.buy_date}
                      {state.position.quantity
                        ? ` · ${state.position.quantity} 股`
                        : ""}
                    </small>
                  </div>
                )}
                <section className="inspector-section">
                  <div className="section-title">
                    <h3>触发依据</h3>
                    <span>双重条件</span>
                  </div>
                  <p className="tiny muted">
                    收盘低于当天开盘，且低于前一日收盘
                  </p>
                  {detail?.signal.evidence.length ? (
                    <table className="evidence-table">
                      <thead>
                        <tr>
                          <th>日期</th>
                          <th>开盘</th>
                          <th>收盘</th>
                          <th>前收</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.signal.evidence.map((e) => (
                          <tr key={e.date}>
                            <td>{e.date.slice(5)}</td>
                            <td>{number(e.open)}</td>
                            <td className="negative">{number(e.close)}</td>
                            <td>{number(e.previous_close)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="muted tiny">暂无已确认的触发区间。</p>
                  )}
                </section>
                {detail?.signal.day10 && (
                  <section className="inspector-section">
                    <div className="section-title">
                      <h3>第十日参考</h3>
                      <span>不限制提醒</span>
                    </div>
                    <dl className="reference">
                      <dt>最低收盘日</dt>
                      <dd>{detail.signal.day10.pivot_date}</dd>
                      <dt>转折后趋势</dt>
                      <dd>
                        {detail.signal.day10.trend_passed
                          ? "恢复上行"
                          : "尚未确认"}
                      </dd>
                      <dt>高于对称点开盘</dt>
                      <dd>{detail.signal.day10.price_passed ? "是" : "否"}</dd>
                      {detail.signal.day10.review_day > 10 && (
                        <>
                          <dt>辅助复核</dt>
                          <dd>第 {detail.signal.day10.review_day} 日</dd>
                        </>
                      )}
                    </dl>
                  </section>
                )}
                <section className="inspector-section">
                  <div className="section-title">
                    <h3>我的笔记</h3>
                    <button
                      className="icon"
                      aria-label="编辑笔记"
                      onClick={() => {
                        setNote(state.note);
                        setModal("note");
                      }}
                    >
                      <NotebookPen size={15} />
                    </button>
                  </div>
                  <p className={`note-copy ${!state.note ? "muted" : ""}`}>
                    {state.note || "记录你的观察，让下一次判断有迹可循。"}
                  </p>
                </section>
                <button
                  className="data-health"
                  onClick={() => setModal("audit")}
                >
                  <ShieldCheck size={16} />
                  <div>
                    <strong>{statusNames[stock.quality]}</strong>
                    <span>
                      {stock.repair_count} 行已修正 · {stock.pending_count}{" "}
                      行待核验
                    </span>
                  </div>
                  <ChevronRight size={15} />
                </button>
                <label className="mute-setting">
                  <input
                    type="checkbox"
                    checked={state.muted}
                    disabled={saving}
                    onChange={(e) => void save({ muted: e.target.checked })}
                  />
                  暂停这只股票的提醒
                </label>
              </>
            )}
          </aside>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
      {modal === "settings" && settingsDraft && (
        <Modal title="设置" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveSettings(settingsDraft);
            }}
          >
            <div className="settings-intro">
              <Mail size={23} />
              <div>
                <h3>每日观察邮件</h3>
                <p>香港时间 08:17，汇总港股和美股最近收盘数据。</p>
              </div>
            </div>
            <label>
              收件邮箱
              <input
                type="email"
                placeholder="you@example.com"
                value={settingsDraft.email}
                onChange={(e) =>
                  setSettingsDraft({ ...settingsDraft, email: e.target.value })
                }
                required={settingsDraft.email_enabled}
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={settingsDraft.email_enabled}
                onChange={(e) =>
                  setSettingsDraft({
                    ...settingsDraft,
                    email_enabled: e.target.checked,
                  })
                }
              />
              启用每日一封邮件
            </label>
            <p className="form-help">
              包含新三连阴、重置、第10日待判断、继续观察及数据异常。
            </p>
            {!data.mail_configured && (
              <div className="notice">
                邮箱可以先保存。发件服务尚未连接，暂不会发送邮件。
              </div>
            )}
            {api.local && (
              <a
                className="text-link"
                href="/api/digest"
                target="_blank"
                rel="noreferrer"
              >
                预览当前日报
                <ExternalLink size={13} />
              </a>
            )}
            <div className="settings-foot">
              <span>
                当前环境：{api.local ? "本地工作区" : "私人云端工作区"}
              </span>
              <span>复权口径：前复权 · 统一 OHLC</span>
            </div>
            <button className="primary full" disabled={saving}>
              {saving ? "保存中…" : "保存设置"}
            </button>
          </form>
        </Modal>
      )}
      {modal === "note" && (
        <Modal title="观察笔记" onClose={() => setModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ note });
            }}
          >
            <label>
              {selected}
              <textarea
                rows={7}
                maxLength={3000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：周线仍在震荡区间，等待放量确认…"
              />
            </label>
            <button className="primary full" disabled={saving}>
              保存笔记
            </button>
          </form>
        </Modal>
      )}
      {modal === "position" && positionDraft && (
        <Modal
          title={state.position ? "管理持仓" : "记录买入"}
          onClose={() => setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save({ position: positionDraft });
            }}
          >
            <p className="form-help">
              保存你实际的成交记录。参考线不执行自动交易。
            </p>
            <label>
              买入日期
              <input
                type="date"
                required
                value={positionDraft.buy_date}
                onChange={(e) =>
                  setPositionDraft({
                    ...positionDraft,
                    buy_date: e.target.value,
                  })
                }
              />
            </label>
            <div className="form-grid">
              <label>
                成交价格
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  required
                  value={positionDraft.buy_price || ""}
                  onChange={(e) =>
                    setPositionDraft({
                      ...positionDraft,
                      buy_price: Number(e.target.value),
                    })
                  }
                />
              </label>
              <label>
                数量（可选）
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  value={positionDraft.quantity ?? ""}
                  onChange={(e) =>
                    setPositionDraft({
                      ...positionDraft,
                      quantity: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </label>
            </div>
            <label>
              持仓状态
              <select
                value={positionDraft.status}
                onChange={(e) =>
                  setPositionDraft({
                    ...positionDraft,
                    status: e.target.value as Position["status"],
                  })
                }
              >
                <option value="open">持有中</option>
                <option value="closed">已卖出</option>
              </select>
            </label>
            {positionDraft.status === "closed" && (
              <div className="form-grid">
                <label>
                  卖出日期
                  <input
                    type="date"
                    value={positionDraft.sell_date || ""}
                    required
                    onChange={(e) =>
                      setPositionDraft({
                        ...positionDraft,
                        sell_date: e.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  卖出价格
                  <input
                    type="number"
                    min="0.000001"
                    step="any"
                    value={positionDraft.sell_price ?? ""}
                    required
                    onChange={(e) =>
                      setPositionDraft({
                        ...positionDraft,
                        sell_price: Number(e.target.value),
                      })
                    }
                  />
                </label>
              </div>
            )}
            <button className="primary full" disabled={saving}>
              保存成交记录
            </button>
          </form>
        </Modal>
      )}
      {modal === "indicators" && (
        <Modal title="图表指标" onClose={() => setModal(null)}>
          <p className="form-help">主图指标与 K 线采用一致的复权价格。</p>
          <div className="indicator-grid">
            {[
              "ma20",
              "ma60",
              "ma120",
              "ma200",
              "ema20",
              "ema60",
              "ema120",
              "ema200",
              "boll",
            ].map((ind) => (
              <label key={ind} className="checkbox-row">
                <input
                  type="checkbox"
                  disabled={saving}
                  checked={data.settings.indicators.includes(ind)}
                  onChange={(e) =>
                    void saveSettings(
                      {
                        ...data.settings,
                        indicators: e.target.checked
                          ? [...data.settings.indicators, ind]
                          : data.settings.indicators.filter((x) => x !== ind),
                      },
                      false,
                    )
                  }
                />
                {ind === "boll" ? "布林带 20 / 2" : ind.toUpperCase()}
              </label>
            ))}
          </div>
          <p className="tiny muted">
            副图支持成交量、MACD、RSI、ATR、KDJ。周/月线末段可能尚未结束。
          </p>
        </Modal>
      )}
      {modal === "audit" && detail && (
        <Modal title={`${selected} · 数据记录`} onClose={() => setModal(null)}>
          <p className="form-help">{detail.price_description}</p>
          <h3>待修正 · {detail.issues.length} 行</h3>
          <div className="audit-scroll">
            {detail.issues.length ? (
              detail.issues.map((i, n) => (
                <div className="audit-row" key={n}>
                  <strong>{i.date || "全部历史"}</strong>
                  <span>{i.kind}</span>
                  <p>{i.reason}</p>
                </div>
              ))
            ) : (
              <p className="muted">当前未发现待修正日线。</p>
            )}
          </div>
          <h3>最近修正记录</h3>
          <div className="audit-scroll">
            {detail.repairs
              .slice(-30)
              .reverse()
              .map((r, n) => (
                <div className="audit-row" key={n}>
                  <strong>{r.date}</strong>
                  <span>{r.source}</span>
                  <p>
                    {r.kind === "remove_non_session"
                      ? "移除休市占位日线"
                      : "用核验后的源数据修正 OHLCV"}
                  </p>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
