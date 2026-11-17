"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { BarcodeScanner } from "@/app/components/BarcodeScanner";
import { QrCode } from "@/app/components/QrCode";

type Role = "admin" | "agent" | "merchant" | "customer";
type Account = { id: string; accountType: string; accountNumber: string; balance: number | string };
type Question = { id: string; question: string; answers: string[] };
type Plan = { score: number; customer: number | string; admin: number | string; agent: number | string };
type Person = { name: string; userId: string; role: Role; shopName?: string; accountNumber?: string };
type Pending = { id: string; name: string; email: string; role: Role; mobile: string; address?: string; examNumber?: string; marks?: number | string; approvalNumber?: string; shopName?: string };
type Recent = { transactionCode: string; category: string; points: number | string; description: string; createdAt: string; pointsDelta: number | string; balanceAfter: number | string };
type Action = (path: string, payload: unknown, success: string) => Promise<Record<string, unknown> | null>;
type DashboardData = {
  user: { id: string; email: string; name: string; role: Role; userId: string; generateIdCard?: boolean; photoDataUrl?: string | null; shopName?: string | null; shopAddress?: string | null };
  accounts: Account[];
  recent: Recent[];
  people: Person[];
  pending?: Pending[];
  plans: Plan[];
  questions?: Question[];
  primaryBalance?: number;
  issuanceAlert?: boolean;
  lifetimeIssued?: number;
  otherBalances?: number;
};

async function requestJson<T>(url: string, init?: RequestInit, options?: { allowUnauthorized?: boolean }): Promise<T | null> {
  const headers = new Headers(init?.headers);
  if (!headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(url, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ((response.status === 401 || response.status === 403) && options?.allowUnauthorized) {
      return null;
    }
    throw new Error(body.error ?? "The request could not be completed.");
  }
  return body as T;
}

function points(value: number | string | undefined) {
  return Number(value ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Home() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [today, setToday] = useState("");
  const refresh = useCallback(async () => {
    try {
      const result = await requestJson<DashboardData>("/api/session", undefined, { allowUnauthorized: true });
      if (!result) {
        setData(null);
        return;
      }
      setData(result);
    } catch (reason) {
      setData(null);
      if (reason instanceof Error && !reason.message.includes("sign in")) setError(reason.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    setToday(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date()));
  }, [refresh]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") payload[key] = value;
    }
    try {
      if (authMode === "login") {
        await requestJson("/api/auth/login", { method: "POST", body: JSON.stringify(payload) });
        await refresh();
        setMessage("Welcome back.");
      } else {
        const photo = form.get("photo");
        if (photo instanceof File && photo.size > 0) {
          if (photo.size > 512 * 1024) throw new Error("Photo must be 512 KB or smaller.");
          payload.photoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the photo."));
            reader.onerror = () => reject(new Error("Could not read the photo."));
            reader.readAsDataURL(photo);
          });
        }
        await requestJson("/api/auth/signup", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Your request has been submitted. An administrator must approve it before you can sign in.");
        setAuthMode("login");
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  async function action(path: string, payload: unknown, success: string): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await requestJson<Record<string, unknown>>(path, { method: path.includes("/plans") ? "PUT" : "POST", body: JSON.stringify(payload) });
      setMessage(result && typeof result.message === "string" ? result.message : success);
      await refresh();
      return result;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete the action.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setData(null);
    setMessage("Signed out.");
  }

  if (loading) return <main className="loading-screen"><span className="brand-mark">L</span><p>Loading your account…</p></main>;
  if (!data) return <AuthScreen mode={authMode} setMode={setAuthMode} onSubmit={submit} busy={busy} message={message} error={error} />;

  const { user } = data;
  const ownAccount = data.accounts.find((account) => account.accountType === (user.role === "admin" ? "admin_primary" : user.role));
  const accountBalance = user.role === "admin" ? data.primaryBalance ?? Number(ownAccount?.balance ?? 0) : Number(ownAccount?.balance ?? 0);

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Loyalty Loop home"><span className="brand-mark">L</span><span>Loyalty<span className="brand-light">Loop</span></span></a>
        <div className="topbar-user">
          <div className="avatar">{user.name.slice(0, 1).toUpperCase()}</div>
          <div className="user-meta"><strong>{user.name}</strong><span>{titleCase(user.role)} · {user.userId}</span></div>
          <button type="button" className="button button-outline button-small" onClick={() => void logout()}>Sign out</button>
        </div>
      </header>

      <div className="page-content">
        <div className="welcome-row">
          <div><p className="eyebrow">{today || "Your dashboard"}</p><h1>{user.role === "admin" ? "Overview" : `Hello, ${user.name.split(" ")[0]}`}</h1><p className="subheading">Here’s your loyalty account at a glance.</p></div>
          {user.role === "admin" && <span className="status-pill"><span className="status-dot" /> Network active</span>}
        </div>

        {message && <div className="notice success" role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss">×</button></div>}
        {error && <div className="notice failure" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss">×</button></div>}

        {data.issuanceAlert && <div className="alert-banner"><span className="alert-symbol">!</span><div><strong>Primary Account alert</strong><p>Lifetime points issued ({points(data.lifetimeIssued)}) exceed the current points in other accounts ({points(data.otherBalances)}).</p></div></div>}

        <section className="stat-grid" aria-label="Account summary">
          <article className="stat-card balance-card"><div className="stat-icon coin-icon">✦</div><p className="stat-label">{user.role === "admin" ? "Primary account balance" : "Available points"}</p><strong className="stat-value">{points(accountBalance)} <span>pts</span></strong><p className="stat-foot">{ownAccount?.accountNumber ?? "Account not assigned"}</p></article>
          {user.role === "admin" ? <>
            <article className="stat-card"><div className="stat-icon mint-icon">↗</div><p className="stat-label">Lifetime points issued</p><strong className="stat-value">{points(data.lifetimeIssued)} <span>pts</span></strong><p className="stat-foot">Cumulative Primary Account funding</p></article>
            <article className="stat-card"><div className="stat-icon gold-icon">◈</div><p className="stat-label">Secondary account</p><strong className="stat-value">{points(data.accounts.find((account) => account.accountType === "admin_secondary")?.balance)} <span>pts</span></strong><p className="stat-foot">Commissions and service charges</p></article>
            <article className="stat-card"><div className="stat-icon violet-icon">◎</div><p className="stat-label">Network accounts</p><strong className="stat-value">{data.people.length}</strong><p className="stat-foot">Active agents, merchants, and customers</p></article>
          </> : <>
            <article className="stat-card"><div className="stat-icon mint-icon">↗</div><p className="stat-label">Transactions</p><strong className="stat-value">{data.recent.length}</strong><p className="stat-foot">Latest account activity</p></article>
            <article className="stat-card"><div className="stat-icon violet-icon">◎</div><p className="stat-label">Partners</p><strong className="stat-value">{data.people.filter((person) => person.role !== user.role).length}</strong><p className="stat-foot">In your loyalty network</p></article>
          </>}
        </section>

        <div className="dashboard-grid">
          <div className="main-column">
            {user.role === "admin" && <AdminActions data={data} busy={busy} action={action} />}
            {user.role === "agent" && <AgentActions data={data} busy={busy} action={action} />}
            {(user.role === "customer" || user.role === "merchant") && <TransferPanel role={user.role} busy={busy} action={action} />}
            <section className="panel activity-panel">
              <div className="panel-header"><div><p className="eyebrow">Account</p><h2>Recent activity</h2></div><span className="panel-count">{data.recent.length} latest</span></div>
              {data.recent.length === 0 ? <EmptyState title="No activity yet" text="Your points activity will appear here." /> : <div className="table-scroll"><table><thead><tr><th>Transaction</th><th>Type</th><th>Date</th><th>Points</th><th>Balance</th></tr></thead><tbody>
                {data.recent.map((row) => <tr key={`${row.transactionCode}-${row.createdAt}-${row.pointsDelta}`}><td><strong>{row.transactionCode}</strong><span className="table-sub">{row.description}</span></td><td>{titleCase(row.category)}</td><td>{new Date(row.createdAt).toLocaleDateString("en-IN")}</td><td className={Number(row.pointsDelta) >= 0 ? "amount-positive" : "amount-negative"}>{Number(row.pointsDelta) >= 0 ? "+" : "−"}{points(Math.abs(Number(row.pointsDelta)))}</td><td>{points(row.balanceAfter)}</td></tr>)}
              </tbody></table></div>}
            </section>
          </div>

          <aside className="side-column">
            {user.generateIdCard !== false && user.userId && ownAccount && <IdCard user={user} account={ownAccount} />}
            <section className="panel partners-panel">
              <div className="panel-header"><div><p className="eyebrow">Explore</p><h2>Partner network</h2></div><span className="panel-count">{data.people.length}</span></div>
              {data.people.length === 0 ? <EmptyState title="No partners yet" text="Approved members will show here." /> : <div className="partner-list">
                {data.people.filter((person) => user.role === "admin" || person.role !== user.role).slice(0, 8).map((person) => <div className="partner-row" key={person.userId}><div className={`partner-avatar ${person.role}`}>{person.name.slice(0, 1).toUpperCase()}</div><div className="partner-info"><strong>{person.shopName || person.name}</strong><span>{titleCase(person.role)} · {person.userId}</span></div><span className={`role-tag ${person.role}`}>{titleCase(person.role)}</span></div>)}
              </div>}
            </section>
            {user.role === "admin" && <PendingApprovals pending={data.pending ?? []} busy={busy} action={action} />}
            {user.role === "merchant" && <section className="panel"><div className="panel-header"><div><p className="eyebrow">Merchant profile</p><h2>{user.shopName || "Your shop"}</h2></div></div><p className="subheading">{user.shopAddress || "Shop address not provided."}</p><p className="field-note">Account: {ownAccount?.accountNumber}</p></section>}
          </aside>
        </div>
      </div>
      <footer className="footer">Loyalty Loop <span>·</span> Points made simple</footer>
    </main>
  );
}

function AuthScreen({ mode, setMode, onSubmit, busy, message, error }: {
  mode: "login" | "signup";
  setMode: (value: "login" | "signup") => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  message: string;
  error: string;
}) {
  const [role, setRole] = useState<Role>("customer");
  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="#"><span className="brand-mark">L</span><span>Loyalty<span className="brand-light">Loop</span></span></a>
        <p className="eyebrow">{mode === "login" ? "Welcome back" : "Join the network"}</p>
        <h1>{mode === "login" ? "Sign in to your account" : "Request an account"}</h1>
        <p className="subheading">{mode === "login" ? "Your points, partners, and rewards in one place." : "Your account becomes active after admin approval."}</p>
        {message && <div className="notice success" role="status">{message}</div>}
        {error && <div className="notice failure" role="alert">{error}</div>}
        <form className="form-stack" onSubmit={onSubmit}>
          {mode === "login" ? <>
            <label>User ID or email<input name="identifier" autoComplete="username" required placeholder="e.g. CUS-12345678" /></label>
            <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          </> : <>
            <div className="field-grid">
              <label>Full name<input name="name" required minLength={2} autoComplete="name" /></label>
              <label>Father’s name<input name="fatherName" /></label>
            </div>
            <label>Email address<input name="email" type="email" required autoComplete="email" /></label>
            <div className="field-grid">
              <label>Mobile number<input name="mobile" type="tel" autoComplete="tel" /></label>
              <label>Date of birth<input name="dateOfBirth" type="date" /></label>
            </div>
            <label>Address<input name="address" autoComplete="street-address" /></label>
            <label>Photo for ID card <span className="label-hint">(optional · JPG, PNG, or WebP · 512 KB max)</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
            <label>Account type<select name="role" value={role} onChange={(event) => setRole(event.target.value as Role)}><option value="customer">Customer</option><option value="merchant">Merchant</option><option value="agent">Agent</option></select></label>
            {role === "customer" ? <div className="field-grid"><label>Exam number<input name="examNumber" required /></label><label>Marks obtained<input name="marks" type="number" min="0" max="9999.99" step="0.01" required /></label></div> : <div className="field-grid">{role === "merchant" && <label>Shop name<input name="shopName" required /></label>}<label>Approval number<input name="approvalNumber" required /></label></div>}
            <label>Password <span className="label-hint">(12 characters minimum)</span><input name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
            <fieldset className="radio-field"><legend>Generate an ID card?</legend><label><input type="radio" name="generateIdCard" value="true" defaultChecked /> Yes</label><label><input type="radio" name="generateIdCard" value="false" /> No</label></fieldset>
          </>}
          <button className="button button-primary submit-button" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Submit request"}<span aria-hidden="true">→</span></button>
        </form>
        <p className="auth-switch">{mode === "login" ? "New to Loyalty Loop?" : "Already have an account?"} <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>{mode === "login" ? "Request access" : "Sign in"}</button></p>
        <div className="secure-note"><span>◆</span> Secure sign-in · Role-protected accounts</div>
      </section>
      <aside className="auth-art"><div className="art-glow" /><div className="art-copy"><span className="art-kicker">REWARDS THAT CIRCULATE</span><h2>Make every point<br />go further.</h2><p>A simpler way for customers, merchants, and agents to be rewarded together.</p><div className="art-stat"><span className="art-stat-icon">✦</span><div><strong>One connected network</strong><span>Points move. Value stays local.</span></div></div></div><div className="art-decoration decor-one">✦</div><div className="art-decoration decor-two">◎</div></aside>
    </main>
  );
}

function AdminActions({ data, busy, action }: { data: DashboardData; busy: boolean; action: Action }) {
  const [plans, setPlans] = useState<Plan[]>(data.plans);
  const [couponResult, setCouponResult] = useState<Array<{ code: string; points: number }>>([]);
  return <>
    <section className="panel">
      <div className="panel-header"><div><p className="eyebrow">Manage points</p><h2>Admin controls</h2></div></div>
      <div className="action-grid">
        <form className="action-card" onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const amount = new FormData(formElement).get("points"); if (await action("/api/points/issue", { points: amount }, "Points issued to Primary Account.")) formElement.reset(); }}>
          <div className="action-icon mint-icon">＋</div><h3>Issue to Primary</h3><p>Record newly issued points in the primary reserve.</p><label>Points<input name="points" type="number" min="0.01" step="0.01" required placeholder="e.g. 1,000" /></label><button className="button button-primary" disabled={busy}>Issue points</button>
        </form>
        <form className="action-card" onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); if (await action("/api/transfer", { recipient: form.get("recipient"), points: form.get("points") }, "Points transferred.")) formElement.reset(); }}>
          <div className="action-icon violet-icon">↗</div><h3>Distribute points</h3><p>Move points from Primary to an approved member.</p><label>Member ID or account number<input name="recipient" required placeholder="CUS-… or LA-…" /></label><label>Points<input name="points" type="number" min="0.01" step="0.01" required /></label><button className="button button-dark" disabled={busy}>Transfer points</button>
        </form>
        <form className="action-card" onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); const result = await action("/api/coupons/generate", { points: form.get("points"), quantity: form.get("quantity") }, "Coupons generated."); if (result) setCouponResult(result.coupons as Array<{ code: string; points: number }>); formElement.reset(); }}>
          <div className="action-icon gold-icon">▦</div><h3>Create product coupons</h3><p>Generate one-time QR coupons for agent redemption.</p><label>Points per coupon<input name="points" type="number" min="0.01" step="0.01" required /></label><label>Quantity<input name="quantity" type="number" min="1" max="50" defaultValue="1" required /></label><button className="button button-outline" disabled={busy}>Generate coupons</button>
        </form>
      </div>
      {couponResult.length > 0 && <div className="coupon-output"><div className="panel-header"><div><p className="eyebrow">Ready to print</p><h3>Generated coupons</h3></div><button className="button button-outline button-small no-print" onClick={() => window.print()}>Print</button></div><div className="coupon-grid">{couponResult.map((coupon) => <div className="coupon-card" key={coupon.code}><QrCode value={coupon.code} label={`Coupon ${coupon.code}`} /><strong>{points(coupon.points)} points</strong><code>{coupon.code}</code><span>One-time redemption</span></div>)}</div></div>}
      <div className="plan-editor">
        <div className="panel-header"><div><p className="eyebrow">Configurable distribution</p><h3>Quiz reward plan</h3></div></div>
        <p className="form-caption">Each row must total 100%. The quiz score is calculated on the server from four answers.</p>
        <div className="table-scroll"><table className="plan-table"><thead><tr><th>Correct</th><th>Customer %</th><th>Admin %</th><th>Agent %</th></tr></thead><tbody>{plans.map((plan, index) => <tr key={plan.score}><td><strong>{plan.score}%</strong></td>{(["customer", "admin", "agent"] as const).map((key) => <td key={key}><input aria-label={`${plan.score}% correct ${key} share`} type="number" min="0" max="100" step="0.01" value={plan[key]} onChange={(event) => setPlans((current) => current.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row))} /></td>)}</tr>)}</tbody></table></div>
        <button className="button button-primary" disabled={busy} onClick={() => void action("/api/admin/plans", { plans }, "Reward plans saved.")}>Save plan</button>
      </div>
    </section>
  </>;
}

function AgentActions({ data, busy, action }: { data: DashboardData; busy: boolean; action: Action }) {
  const [couponCode, setCouponCode] = useState("");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const setCode = useCallback((value: string) => setCouponCode(value), []);
  const allAnswered = (data.questions ?? []).length === 4 && (data.questions ?? []).every((question) => answers[question.id]);
  return <>
    <section className="panel">
      <div className="panel-header"><div><p className="eyebrow">Agent tools</p><h2>Redeem & reward</h2></div></div>
      <div className="action-grid agent-grid">
        <div className="action-card">
          <div className="action-icon gold-icon">▦</div><h3>Redeem product coupon</h3><p>Scan a product coupon to credit your agent account.</p>
          <label>Coupon code<input value={couponCode} onChange={(event) => setCouponCode(event.target.value)} placeholder="Scan or enter the code" /></label>
          <BarcodeScanner onScan={setCode} />
          <button className="button button-primary" disabled={busy || !couponCode.trim()} onClick={async () => { if (await action("/api/coupons/redeem", { code: couponCode }, "Coupon redeemed to your account.")) setCouponCode(""); }}>Redeem coupon</button>
        </div>
        <div className="action-card">
          <div className="action-icon mint-icon">✦</div><h3>Send reward to customer</h3><p>Points are split by the active plan after the four-question quiz.</p>
          <label>Customer user ID<input value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder="CUS-…" /></label>
          <div className="scanner-inline"><BarcodeScanner onScan={setRecipient} /></div>
          <label>Points to distribute<input value={amount} onChange={(event) => setAmount(event.target.value)} type="number" min="0.01" step="0.01" placeholder="e.g. 50" /></label>
          <div className="quiz-block"><h4>Customer quiz</h4>{(data.questions ?? []).map((question, index) => <fieldset className="quiz-question" key={question.id}><legend><span>{String(index + 1).padStart(2, "0")}</span>{question.question}</legend>{question.answers.map((answer) => <label className="quiz-answer" key={answer}><input type="radio" name={`q-${question.id}`} checked={answers[question.id] === answer} onChange={() => setAnswers((current) => ({ ...current, [question.id]: answer }))} />{answer}</label>)}</fieldset>)}{(data.questions ?? []).length !== 4 && <p className="field-note">Four active quiz questions are required. Ask the administrator to configure them.</p>}</div>
          <button className="button button-primary" disabled={busy || !recipient || !amount || !allAnswered} onClick={async () => { if (await action("/api/rewards/distribute", { recipient, points: amount, answers: (data.questions ?? []).map((question) => ({ questionId: question.id, answer: answers[question.id] })) }, "Reward distributed using the configured plan.")) { setAmount(""); setAnswers({}); } }}>Submit answers & send</button>
        </div>
      </div>
    </section>
  </>;
}

function TransferPanel({ role, busy, action }: { role: "customer" | "merchant"; busy: boolean; action: Action }) {
  const [recipient, setRecipient] = useState("");
  const setScannedRecipient = useCallback((value: string) => setRecipient(value), []);
  return <section className="panel">
    <div className="panel-header"><div><p className="eyebrow">{role === "merchant" ? "Customer rewards" : "Use your points"}</p><h2>{role === "merchant" ? "Send a discount" : "Transfer points"}</h2></div></div>
    <p className="form-caption">{role === "merchant" ? "Transfer points from your merchant balance to a customer." : "Send points to a participating merchant or agent."} Automatic balance sweeps are not enabled.</p>
    <form className="transfer-form" onSubmit={async (event) => { event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement); if (await action("/api/transfer", { recipient: form.get("recipient"), points: form.get("points") }, "Transfer complete.")) { formElement.reset(); setRecipient(""); } }}>
      <label>Recipient user ID or account number<input name="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} required placeholder={role === "merchant" ? "CUS-… or LA-…" : "MER-… or AGT-…"} /></label>
      <BarcodeScanner onScan={setScannedRecipient} />
      <label>Points<input name="points" type="number" min="0.01" step="0.01" required placeholder="0.00" /></label>
      <button className="button button-primary" disabled={busy}>Review & transfer <span>→</span></button>
    </form>
  </section>;
}

function PendingApprovals({ pending, busy, action }: { pending: Pending[]; busy: boolean; action: Action }) {
  return <section className="panel approvals-panel"><div className="panel-header"><div><p className="eyebrow">Review requests</p><h2>Pending approvals</h2></div><span className="panel-count">{pending.length}</span></div>
    {pending.length === 0 ? <EmptyState title="All caught up" text="There are no signup requests waiting for review." /> : <div className="approval-list">{pending.map((request) => <div className="approval-item" key={request.id}><div className="partner-avatar pending-avatar">{request.name.slice(0, 1).toUpperCase()}</div><div className="approval-info"><strong>{request.name}</strong><span>{titleCase(request.role)}{request.shopName ? ` · ${request.shopName}` : ""}</span><span>{request.email}{request.mobile ? ` · ${request.mobile}` : ""}</span><span>{request.examNumber ? `Exam ${request.examNumber} · Marks ${points(request.marks)}` : `Approval ${request.approvalNumber ?? "not provided"}`}</span><span>{request.address || "No address provided"}</span></div><div className="approval-actions"><button className="button button-small button-primary" disabled={busy} onClick={() => void action(`/api/admin/approvals/${request.id}`, { decision: "approve" }, "Request approved. A user ID and points account were created.")}>Approve</button><button className="button button-small button-outline" disabled={busy} onClick={() => void action(`/api/admin/approvals/${request.id}`, { decision: "reject" }, "Request rejected.")}>Reject</button></div></div>)}</div>}
  </section>;
}

function IdCard({ user, account }: { user: DashboardData["user"]; account: Account }) {
  return <section className="id-card-panel">
    <div className="panel-header no-print"><div><p className="eyebrow">Your membership</p><h2>Digital ID card</h2></div><button className="button button-outline button-small" onClick={() => window.print()}>Print card</button></div>
    <div className="member-card print-card">
      <div className="member-card-head"><span className="member-brand"><span className="brand-mark">L</span> LoyaltyLoop</span><span className="member-type">{titleCase(user.role)}</span></div>
      <div className="member-card-body">{user.photoDataUrl ? <img className="member-photo member-photo-image" src={user.photoDataUrl} alt={`${user.name} profile`} /> : <div className="member-photo">{user.name.slice(0, 1).toUpperCase()}</div>}<div className="member-info"><span className="member-label">MEMBER</span><strong>{user.name}</strong><span>{user.userId}</span><code>{account.accountNumber}</code></div></div>
      <div className="member-card-code"><QrCode value={account.accountNumber} label={`Membership QR for ${user.name}`} /><span>Scan to identify account</span></div>
    </div>
  </section>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span>◎</span><strong>{title}</strong><p>{text}</p></div>;
}
