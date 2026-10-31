import { useEffect, useState } from 'react';
import AppLayout, { PageHero } from '../components/Layout.jsx';
import { Chevron, Close, UserCircle } from '../components/Icons.jsx';
import { del, get, patch, post } from '../lib/api.js';
import { useStartSession } from './Home.jsx';
import './groups.css';

const PREFS = ['No restrictions', 'No pork', 'Vegetarian', 'Vegan', 'Nut allergy', 'Seafood allergy', 'Dairy free', 'Gluten-free'];

function MemberRow({ group, member, onChange }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(member.preference);

  const save = async (e) => {
    e.preventDefault();
    const { group: g } = await patch(`/groups/${group.id}/members/${member.id}`, { preference: value });
    onChange(g);
    setEditing(false);
  };

  return (
    <li className="member">
      <UserCircle width={40} height={40} />
      {editing ? (
        <form className="member__edit" onSubmit={save}>
          <strong>{member.name}</strong>
          <input list="pref-options" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`${member.name}'s preference`} autoFocus />
          <button className="mini mini--fill" type="submit">Save</button>
          <button className="mini" type="button" onClick={() => { setValue(member.preference); setEditing(false); }}>Cancel</button>
        </form>
      ) : (
        <>
          <span className="member__text"><strong>{member.name}</strong> · {member.preference}</span>
          <span className="member__actions">
            <button className="mini" onClick={() => setEditing(true)}>Edit Preference</button>
            <button
              className="icon-btn" aria-label={`Remove ${member.name}`}
              onClick={async () => onChange((await del(`/groups/${group.id}/members/${member.id}`)).group)}
            ><Close width={18} height={18} /></button>
          </span>
        </>
      )}
    </li>
  );
}

function GroupCard({ group, onChange, onStart, starting }) {
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
        <h3><span>{group.name.toUpperCase()}</span> · {group.members.length} {group.members.length === 1 ? 'Person' : 'People'}</h3>
        <button className="btn btn--red gcard__start" onClick={() => onStart(group.id)} disabled={starting}>Start a Session <Chevron size={22} /></button>
      </div>
      {group.members.length === 0 && <p className="gcard__empty">No one here yet. Add your friends below.</p>}
      <ul className="members">
        {group.members.map((m) => <MemberRow key={m.id} group={group} member={m} onChange={onChange} />)}
      </ul>
      <form className="gcard__add" onSubmit={add}>
        <input className="input" placeholder="Input Friend’s name" aria-label="Friend's name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn--red gcard__addbtn" type="submit">+ Add</button>
      </form>
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
      <datalist id="pref-options">{PREFS.map((p) => <option key={p} value={p} />)}</datalist>

      <section className="container groups">
        <div className="groups__bar">
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
                <span className="group__pill">{g.name} ({g.members.length})</span>
                <Chevron size={44} dir={open ? 'down' : 'right'} />
              </button>
              {open && <GroupCard group={g} onChange={replace} onStart={startSession} starting={starting} />}
            </div>
          );
        })}
      </section>
    </AppLayout>
  );
}
