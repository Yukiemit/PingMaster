import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppLayout, { PageHero } from '../components/Layout.jsx';
import { Caret, CheckCircle, Close, Doc, Equals, Info, Plus, Receipt, Users, Warn, Check } from '../components/Icons.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { get } from '../lib/api.js';
import { peso } from '../lib/format.js';
import { splitByOrder, splitEqually } from '../lib/split.js';
import './split.css';

let nextId = 100;
const newItem = (name = '', amount = '', sharedBy = []) => ({ id: `i${nextId++}`, name, amount, sharedBy });

function sample(me) {
  const members = [
    { id: 'me', name: me?.name || 'You', me: true },
    { id: 'rich', name: 'Rich' }, { id: 'pia', name: 'Pia' }, { id: 'tian', name: 'Tian' }, { id: 'yuki', name: 'Yuki' },
  ];
  const items = [
    newItem('4 pc Chickenjoy Family Box', '180.00', ['me', 'rich', 'pia', 'tian']),
    newItem('Burger Steak w/ Drink', '160.00', ['yuki']),
    newItem('Regular Fries w/ Coke Float', '150.00', ['tian']),
    newItem('Iced Mocha Float', '120.00', ['rich']),
    newItem('10 pc Chicken Nuggets Solo', '0.00', ['me', 'rich', 'pia', 'tian', 'yuki']),
  ];
  return { title: 'Lunch with Ping Master', subtitle: 'Sample Session', members, items, extra: '40.00', total: '650.00' };
}

const initial = (n) => n.trim().charAt(0).toUpperCase();
const two = (n) => n.trim().slice(0, 2).toUpperCase();
const money = (v) => v.replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');
const fix2 = (v) => (v === '' ? '' : (Number(v) || 0).toFixed(2));

function Avatar({ m, size = 'md', label }) {
  return <span className={`av av--${size}${m.me ? ' av--me' : ''}`} aria-hidden="true">{label ?? initial(m.name)}</span>;
}

function ItemRow({ item, members, open, onToggle, onChange, onRemove }) {
  const share = item.sharedBy.length ? (Number(item.amount) || 0) / item.sharedBy.length : 0;
  const who = members.filter((m) => item.sharedBy.includes(m.id));
  const set = (patch) => onChange({ ...item, ...patch });
  const toggleMember = (id) => set({ sharedBy: item.sharedBy.includes(id) ? item.sharedBy.filter((x) => x !== id) : [...item.sharedBy, id] });

  return (
    <li className={`item${open ? ' item--open' : ''}`}>
      <div className="item__row">
        <input className="item__name" placeholder="Item name" aria-label="Item name" value={item.name} onChange={(e) => set({ name: e.target.value })} />
        <span className="item__peso">₱</span>
        <input className="item__amt" inputMode="decimal" placeholder="0.00" aria-label={`Amount for ${item.name || 'item'}`} value={item.amount} onChange={(e) => set({ amount: money(e.target.value) })} onBlur={() => set({ amount: fix2(item.amount) })} />
        <button className="item__who" onClick={onToggle} aria-expanded={open} aria-label={`Choose who shared ${item.name || 'this item'}`}>
          <span className="stack">
            {who.length ? who.map((m) => <Avatar key={m.id} m={m} size="xs" />) : <span className="item__none"><Warn width={14} height={14} /> Assign</span>}
          </span>
          <span className="item__edit">Edit <Caret up={open} width={16} height={16} /></span>
        </button>
        <button className="item__x" onClick={onRemove} aria-label={`Remove ${item.name || 'item'}`}><Close width={18} height={18} /></button>
      </div>

      {open && (
        <div className="assign">
          <div className="assign__head">
            <div>
              <strong>{item.name || 'Untitled item'}</strong>
              <small>{item.sharedBy.length} member{item.sharedBy.length === 1 ? '' : 's'} sharing this item</small>
            </div>
            <div className="assign__total"><small>Item total</small><b>{peso(item.amount)}</b></div>
          </div>
          <button className="assign__all" onClick={() => set({ sharedBy: members.map((m) => m.id) })}><Users width={18} height={18} /> Assign everyone</button>
          <div className="assign__or"><span>OR TAP A PROFILE</span></div>
          <ul className="assign__list">
            {members.map((m) => {
              const on = item.sharedBy.includes(m.id);
              return (
                <li key={m.id}>
                  <button className={`person${on ? ' on' : ''}`} aria-pressed={on} onClick={() => toggleMember(m.id)}>
                    <Avatar m={m} label={two(m.name)} />
                    <span className="person__name">{m.name}{m.me && <em> (You)</em>}</span>
                    <span className="person__amt">{on ? <><b>{peso(share)}</b><small>Assigned</small></> : <small>Tap to assign</small>}</span>
                    <span className="person__tick">{on && <Check width={16} height={16} />}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="assign__foot"><CheckCircle width={16} height={16} /> Tap again to remove · Shares update instantly</p>
        </div>
      )}
    </li>
  );
}

export default function SplitBill() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const sessionId = params.get('session');
  const [state, setState] = useState(() => sample(user));
  const [mode, setMode] = useState('order');
  const [openItem, setOpenItem] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [reviewed, setReviewed] = useState(false);

  // When opened from a finished session, use its real members.
  useEffect(() => {
    if (!sessionId) return;
    get(`/sessions/${sessionId}`).then(({ session }) => {
      const members = session.participants.map((p) => ({ id: p.id, name: p.name, me: p.id === session.me.id }));
      members.sort((a, b) => (b.me ? 1 : 0) - (a.me ? 1 : 0));
      setState({
        title: session.name,
        subtitle: session.picked ? session.picked.name : 'Session',
        members, items: [newItem()], extra: '', total: '',
      });
      setOpenItem(null);
    }).catch(() => {});
  }, [sessionId]);

  const { members, items } = state;
  const extra = Number(state.extra) || 0;
  const discount = Number(state.discount) || 0;
  const order = useMemo(() => splitByOrder(items, members, extra, discount), [items, members, extra, discount]);
  const equal = useMemo(() => splitEqually(Number(state.total) || 0, members), [state.total, members]);
  const shares = mode === 'order' ? order.shares : equal;
  const total = mode === 'order' ? order.receipt : Number(state.total) || 0;

  const patch = (p) => { setReviewed(false); setState((s) => ({ ...s, ...p })); };
  const allOpen = members.every((m) => expanded[m.id]);
  const review = () => {
    const next = !allOpen;
    setExpanded(Object.fromEntries(members.map((m) => [m.id, next])));
    setReviewed(next);
  };

  let status;
  if (mode === 'order') {
    if (order.unassigned) status = { ok: false, text: `${order.unassigned} item${order.unassigned > 1 ? 's' : ''} not assigned yet. Tap Edit to pick who shared it.` };
    else if (total <= 0) status = { ok: false, text: 'Add the items from your receipt to see each share.' };
    else status = { ok: true, text: reviewed ? 'Breakdown reviewed. Total matches.' : 'All items assigned. Total matches.' };
  } else {
    status = total > 0
      ? { ok: true, text: reviewed ? 'Breakdown reviewed. Total matches.' : `All ${members.length} shares add up to the receipt total.` }
      : { ok: false, text: 'Enter the final receipt total.' };
  }

  return (
    <AppLayout>
      <PageHero line1="Split the" line2="Bill" sub="Done eating? Split the bill easily and fairly." />

      <div className="split container">
        <section className="sbar">
          <span className="sbar__icon"><Users width={30} height={30} /></span>
          <div className="sbar__text">
            <strong>{state.title}</strong>
            <small>{state.subtitle} • {members.length} Members</small>
          </div>
          <ul className="sbar__members">
            {members.map((m) => <li key={m.id} className={m.me ? 'me' : ''}>{m.name}{m.me && ' · You'}</li>)}
          </ul>
        </section>

        <div className="split__grid">
          <div className="split__left">
            <section className="scard">
              <h2 className="scard__title"><span className="num">1</span> How are we splitting?</h2>
              <div className="modes" role="radiogroup" aria-label="Split method">
                {[
                  ['equal', 'Split equally', 'Same share for everyone', Equals],
                  ['order', 'By order', 'Individual + shared items', Doc],
                ].map(([k, t, d, Icon]) => (
                  <button key={k} role="radio" aria-checked={mode === k} className={`mode${mode === k ? ' on' : ''}`} onClick={() => { setMode(k); setReviewed(false); }}>
                    <Icon width={22} height={22} />
                    <span><b>{t}</b><small>{d}</small></span>
                    <i className="mode__dot" />
                  </button>
                ))}
              </div>
            </section>

            {mode === 'order' ? (
              <section className="scard">
                <h2 className="scard__title"><span className="num">2</span> What’s on the receipt?</h2>
                <p className="scard__sub">Enter each item’s total. Tap its profiles to choose who shared it.</p>
                <div className="items__head"><span>ITEM</span><span>AMOUNT</span><span>SHARED BY</span></div>
                <ul className="items">
                  {items.map((it) => (
                    <ItemRow
                      key={it.id} item={it} members={members} open={openItem === it.id}
                      onToggle={() => setOpenItem(openItem === it.id ? null : it.id)}
                      onChange={(n) => patch({ items: items.map((x) => (x.id === n.id ? n : x)) })}
                      onRemove={() => patch({ items: items.filter((x) => x.id !== it.id) })}
                    />
                  ))}
                </ul>
                <button className="items__add" onClick={() => { const it = newItem(); patch({ items: [...items, it] }); setOpenItem(it.id); }}><Plus width={20} height={20} /> Add an item</button>

                <div className="adj">
                  <label>Extra charges / service fee
                    <span className="money"><i>₱</i><input inputMode="decimal" placeholder="0.00" value={state.extra} onChange={(e) => patch({ extra: money(e.target.value) })} onBlur={() => patch({ extra: fix2(state.extra) })} /></span>
                  </label>
                  <label>Group-wide discount
                    <span className="money"><i>₱</i><input inputMode="decimal" placeholder="0.00" value={state.discount ?? ''} onChange={(e) => patch({ discount: money(e.target.value) })} onBlur={() => patch({ discount: fix2(state.discount ?? '') })} /></span>
                  </label>
                </div>
                <p className="scard__note">From the receipt; allocated in proportion to each person’s items. Add only amounts not included above.</p>
                <div className="receipt"><span>Receipt total</span><b>{peso(order.receipt)}</b></div>
              </section>
            ) : (
              <section className="scard">
                <h2 className="scard__title"><span className="num">2</span> Enter the bill total</h2>
                <p className="scard__sub">Enter the final amount shown on your receipt.</p>
                <label className="final">Final receipt total
                  <span className="money money--big"><i>₱</i><input inputMode="decimal" placeholder="0.00" value={state.total} onChange={(e) => patch({ total: money(e.target.value) })} onBlur={() => patch({ total: fix2(state.total) })} /></span>
                </label>
                <p className="scard__note">Include taxes and service fees, after any discounts.</p>
                <div className="between"><span>Split between</span><b>All {members.length} members</b></div>
                <p className="scard__note">Everyone covers an equal share of the final bill.</p>
              </section>
            )}
          </div>

          <aside className="summary">
            <div className="summary__top">
              <p className="summary__kicker"><Receipt width={22} height={22} /> TOTAL TO SPLIT</p>
              <p className="summary__total">{peso(total)}</p>
              <p className="summary__meta">{members.length} members · {mode === 'order' ? 'By order' : 'Split equally'}</p>
            </div>
            <div className="summary__body">
              <h3>Each person’s share <span className="live">● LIVE</span></h3>
              <ul className="shares">
                {members.map((m) => {
                  const s = shares.find((x) => x.id === m.id);
                  const open = !!expanded[m.id];
                  return (
                    <li key={m.id}>
                      <button className="share" aria-expanded={open} onClick={() => setExpanded((e) => ({ ...e, [m.id]: !open }))}>
                        <Avatar m={m} size="lg" />
                        <span className="share__name">{m.name}{m.me && <em> (You)</em>}</span>
                        <b>{peso(s?.total)}</b>
                        <Caret up={open} width={20} height={20} />
                      </button>
                      {open && (
                        <ul className="share__lines">
                          {s?.lines.length ? s.lines.map((l, i) => (
                            <li key={i} className={l.muted ? 'muted' : ''}><span>{l.label}{l.shared && <> · <br />shared</>}</span><span>{peso(l.amount)}</span></li>
                          )) : <li className="muted"><span>Nothing assigned yet</span><span>{peso(0)}</span></li>}
                        </ul>
                      )}
                    </li>
                  );
                })}
              </ul>

              {mode === 'order' ? (
                <dl className="totals">
                  <div><dt>Items subtotal</dt><dd>{peso(order.subtotal)}</dd></div>
                  <div><dt>Extra charges</dt><dd>{peso(extra)}</dd></div>
                  <div><dt>Group discount</dt><dd>-{peso(discount)}</dd></div>
                </dl>
              ) : (
                <dl className="totals">
                  <div><dt>Receipt total</dt><dd>{peso(total)}</dd></div>
                  <div><dt>Participants</dt><dd>{members.length} members</dd></div>
                </dl>
              )}

              <p className={`status${status.ok ? '' : ' status--warn'}`} role="status">
                {status.ok ? <CheckCircle width={20} height={20} /> : <Warn width={20} height={20} />} {status.text}
              </p>
              <button className="btn btn--red review" onClick={review}>{allOpen ? 'Hide full breakdown' : 'Review breakdown'} →</button>
              <p className="disclaimer"><Info width={20} height={20} /> Calculation only. Settle payments directly with your group; Saan Tayo? does not process payments.</p>
            </div>
          </aside>
        </div>
      </div>
    </AppLayout>
  );
}
