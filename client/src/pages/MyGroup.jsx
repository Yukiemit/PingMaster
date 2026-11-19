import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout, { PageHero } from '../components/Layout.jsx';
import { Chevron, Close, UserCircle } from '../components/Icons.jsx';
import { del, get, patch, post } from '../lib/api.js';
import { useStartSession } from './Home.jsx';
import './groups.css';

const PREFS = ['No restrictions', 'No pork', 'Vegetarian', 'Vegan', 'Nut allergy', 'Seafood allergy', 'Dairy free', 'Gluten-free'];

const NONE = PREFS[0];

// "No pork, Nut allergy, Halal" -> picked chips + anything typed in "Other".
function splitPreference(text) {
  const parts = String(text || '').split(',').map((x) => x.trim()).filter(Boolean);
  const picked = parts.filter((x) => PREFS.some((p) => p.toLowerCase() === x.toLowerCase()))
    .map((x) => PREFS.find((p) => p.toLowerCase() === x.toLowerCase()));
  const other = parts.filter((x) => !PREFS.some((p) => p.toLowerCase() === x.toLowerCase())).join(', ');
  return { picked: picked.length || other ? picked : [NONE], other };
}

function PreferenceEditor({ member, onSave, onCancel }) {
  const start = splitPreference(member.preference);
  const [picked, setPicked] = useState(start.picked);
  const [other, setOther] = useState(start.other);
  const [busy, setBusy] = useState(false);

  const toggle = (p) => {
    if (p === NONE) { setPicked([NONE]); setOther(''); return; }
    const without = picked.filter((x) => x !== NONE);
    const next = without.includes(p) ? without.filter((x) => x !== p) : [...without, p];
    setPicked(next.length ? next : [NONE]);
  };

  const save = async (e) => {
    e.preventDefault();
    const list = [...picked.filter((x) => x !== NONE || !other.trim()), ...(other.trim() ? [other.trim()] : [])];
    setBusy(true);
    try { await onSave(list.join(', ') || NONE); } finally { setBusy(false); }
  };

  return (
    <form className="pedit" onSubmit={save}>
      <strong className="pedit__name">{member.name}</strong>
      <div className="pedit__chips" role="group" aria-label={`${member.name}'s dietary needs`}>
        {PREFS.map((p) => (
          <button key={p} type="button" className={`pedit__chip${p === NONE ? ' pedit__chip--none' : ''}`} aria-pressed={picked.includes(p)} onClick={() => toggle(p)}>
            {picked.includes(p) && p !== NONE ? '✓ ' : ''}{p}
          </button>
        ))}
      </div>
      <div className="pedit__row">
        <input
          className="pedit__other" placeholder="Other (e.g. Halal, no spicy food)" value={other}
          onChange={(e) => { setOther(e.target.value); if (e.target.value.trim()) setPicked((cur) => cur.filter((x) => x !== NONE)); }}
          aria-label="Other dietary need"
        />
        <button className="mini mini--fill" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        <button className="mini" type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function MemberRow({ group, member, onChange, onLeave }) {
  const isOwner = group.role === 'owner';
  const canEdit = isOwner || member.isYou;
  const [editing, setEditing] = useState(false);

  const save = async (preference) => {
    const { group: g } = await patch(`/groups/${group.id}/members/${member.id}`, { preference });
    onChange(g);
    setEditing(false);
  };

  return (
    <li className="member">
      <UserCircle width={40} height={40} />
      {editing ? (
        <PreferenceEditor member={member} onSave={save} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <span className="member__text">
            <strong>{member.name}</strong>{member.isYou && <em className="member__tag">You</em>}
            {!member.hasAccount && <em className="member__tag member__tag--warn" title="Added before accounts were required">No account</em>}
            {' · '}{member.preference}
          </span>
          <span className="member__actions">
            {canEdit && <button className="mini" onClick={() => setEditing(true)}>Edit Preference</button>}
            {isOwner && (
              <button
                className="icon-btn" aria-label={`Remove ${member.name}`}
                onClick={async () => onChange((await del(`/groups/${group.id}/members/${member.id}`)).group)}
              ><Close width={18} height={18} /></button>
            )}
            {!isOwner && member.isYou && (
              <button className="mini" onClick={async () => { await del(`/groups/${group.id}/members/${member.id}`); onLeave(group.id); }}>Leave</button>
            )}
          </span>
        </>
      )}
    </li>
  );
}

function GroupCard({ group, onChange, onLeave, onStart, starting }) {
  const navigate = useNavigate();
  const isOwner = group.role === 'owner';
  const open = group.openSession;
  const people = group.members.length + 1;
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const add = async (e) => {
    e.preventDefault();
    setError('');
    try {
      onChange((await post(`/groups/${group.id}/members`, { name })).group);
      setName('');
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="gcard">
      <div className="gcard__head">
        <h3><span>{group.name.toUpperCase()}</span> · {people} {people === 1 ? 'Person' : 'People'}</h3>
        {isOwner && open && (
          <button className="btn btn--cream gcard__start" onClick={() => navigate(`/session/${open.id}`)}>Open Current Session <Chevron size={22} /></button>
        )}
        {isOwner && !open && (
          <button className="btn btn--red gcard__start" onClick={() => onStart(group.id)} disabled={starting}>Start a Session <Chevron size={22} /></button>
        )}
        {!isOwner && open && (
          <button className="btn btn--red gcard__start" onClick={() => navigate(`/session/${open.id}`)}>Join {group.owner.name}’s Session <Chevron size={22} /></button>
        )}
      </div>
      <ul className="members">
        <li className="member member--owner">
          <UserCircle width={40} height={40} />
          <span className="member__text">
            <strong>{group.owner.name}</strong>{group.owner.isYou && <em className="member__tag">You</em>}
            {' · '}<span className="member__owner">Group owner</span>
          </span>
        </li>
        {group.members.map((m) => <MemberRow key={m.id} group={group} member={m} onChange={onChange} onLeave={onLeave} />)}
      </ul>
      {isOwner ? (
        <>
          {group.members.length === 0 && <p className="gcard__empty">No friends here yet. Add them below.</p>}
          <form className="gcard__add" onSubmit={add}>
            <input className="input" placeholder="Friend’s account name or email" aria-label="Friend's account name or email" value={name} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn--red gcard__addbtn" type="submit">+ Add</button>
          </form>
          <p className="gcard__hint">Friends need a Saan Tayo? account. Type their account name exactly (shown in their profile menu) or their email.</p>
        </>
      ) : (
        <p className="gcard__hint">
          {group.owner.name} made this group. Only they can add or remove people, start a session and choose the meetup spot.
          {!open && ' Their next session will show up here.'}
        </p>
      )}
      {isOwner && open && (
        <p className="gcard__hint">
          “{open.name}” is still being planned. <button type="button" className="linkish" onClick={() => onStart(group.id)} disabled={starting}>Start a new session instead</button>
        </p>
      )}
      {error && <p className="alert alert--error" style={{ marginTop: 12 }}>{error}</p>}
    </div>
  );
}

export default function MyGroup() {
  const [groups, setGroups] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [startSession, starting] = useStartSession();

  useEffect(() => {
    get('/groups').then(({ groups }) => { setGroups(groups); setOpenId(groups[0]?.id ?? null); }).catch(() => setGroups([]));
  }, []);

  const replace = (g) => setGroups((gs) => gs.map((x) => (x.id === g.id ? g : x)));
  const leave = (id) => { setGroups((gs) => gs.filter((x) => x.id !== id)); setOpenId(null); };

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    const { group } = await post('/groups', { name: newName });
    setGroups((gs) => [...gs, group]);
    setOpenId(group.id);
    setNewName('');
    setCreating(false);
  };

  return (
    <AppLayout>
      <PageHero
        line1="My"
        line2="GROUP."
        sub="The usual friends you eat with and bond with."
        action={<button className="btn btn--cream" onClick={() => startSession()} disabled={starting}>Start My Session <Chevron /></button>}
      />

      <section className="container groups">
        <div className={`groups__bar${groups?.length ? '' : ' groups__bar--static'}`}>
          {creating ? (
            <form className="groups__new" onSubmit={create}>
              <input autoFocus placeholder="Group name (e.g. Office Lunch)" aria-label="New group name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <button className="btn btn--green btn--sm" type="submit">Create</button>
              <button className="btn btn--outline-green btn--sm" type="button" onClick={() => setCreating(false)}>Cancel</button>
            </form>
          ) : (
            <button className="btn btn--outline-green groups__make" onClick={() => setCreating(true)}>+ Make Group</button>
          )}
        </div>

        {groups?.length === 0 && <p className="empty">You don’t have a group yet. Make one for your barkada, family, or office lunch crew.</p>}

        {groups?.map((g) => {
          const open = openId === g.id;
          return (
            <div key={g.id} className="group">
              <button className={`group__toggle${open ? ' open' : ''}`} aria-expanded={open} onClick={() => setOpenId(open ? null : g.id)}>
                <span className="group__pill">{g.name} ({g.members.length + 1}){g.role === 'member' ? ' · Member' : ''}</span>
                <Chevron size={44} dir={open ? 'down' : 'right'} />
              </button>
              {open && <GroupCard group={g} onChange={replace} onLeave={leave} onStart={startSession} starting={starting} />}
            </div>
          );
        })}
      </section>
    </AppLayout>
  );
}
