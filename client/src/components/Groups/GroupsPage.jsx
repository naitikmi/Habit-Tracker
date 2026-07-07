import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../Layout/Toast';
import {
  loadGroups, createGroup, getGroup, addGroupMembers, removeGroupMember,
  getGroupChallenge, saveGroupChallenge, sendGroupMessage, loadGroupMessages, deleteGroup
} from '../../utils/api';
import { COLORS } from '../../utils/helpers';

export default function GroupsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [msgText, setMsgText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [groupChallenge, setGroupChallenge] = useState(null);
  const [memberInput, setMemberInput] = useState('');
  const [creating, setCreating] = useState(false);
  const msgEndRef = useRef(null);

  useEffect(() => { loadGroups().then(setGroups); }, []);

  useEffect(() => {
    if (msgEndRef.current) msgEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openGroup = async (g) => {
    setSelectedGroup(g);
    setMessages([]);
    setGroupChallenge(null);
    const [msgs, ch] = await Promise.all([
      loadGroupMessages(g._id),
      getGroupChallenge(g._id)
    ]);
    setMessages(msgs);
    setGroupChallenge(ch);
  };

  const sendMessage = async () => {
    if (!msgText.trim()) return;
    const msg = await sendGroupMessage(selectedGroup._id, msgText);
    if (msg) {
      setMessages(prev => [...prev, msg]);
      setMsgText('');
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    if (!name) { showToast('Enter a group name'); return; }
    setCreating(true);
    const g = await createGroup(name, []);
    if (g) {
      setGroups(prev => [g, ...prev]);
      setShowCreate(false);
      showToast('Group created!');
    } else {
      showToast('Failed to create group');
    }
    setCreating(false);
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    const username = memberInput.trim();
    if (!username) return;
    const r = await fetch('/api/auth/search?q=' + encodeURIComponent(username), { headers: { Authorization: 'Bearer ' + localStorage.getItem('challengeToken') } });
    const data = await r.json();
    if (data && data.ok && data.data) {
      const ids = [data.data._id];
      const updated = await addGroupMembers(selectedGroup._id, ids);
      if (updated) {
        setSelectedGroup(updated);
        setMemberInput('');
        setShowAddMember(false);
        showToast('Member added!');
      }
    } else {
      showToast('User not found');
    }
  };

  const handleRemoveMember = async (memberId) => {
    const updated = await removeGroupMember(selectedGroup._id, memberId);
    if (updated) {
      setSelectedGroup(updated);
      showToast('Member removed');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Delete this group and its challenge?')) return;
    const ok = await deleteGroup(selectedGroup._id);
    if (ok) {
      setGroups(prev => prev.filter(g => g._id !== selectedGroup._id));
      setSelectedGroup(null);
      showToast('Group deleted');
    }
  };

  const handleCreateChallenge = async (e) => {
    e.preventDefault();
    const form = e.target;
    const name = form.name.value.trim();
    const days = Number(form.days.value);
    const startDate = form.startDate.value;
    if (!name || !days || !startDate) { showToast('Fill all fields'); return; }

    const habitInputs = form.querySelectorAll('.gh-habit-input');
    const habits = [];
    for (const inp of habitInputs) {
      const hName = inp.value.trim();
      if (hName) habits.push({ name: hName, maxPoints: 10 });
    }
    if (!habits.length) { showToast('Add at least one habit'); return; }

    const result = await saveGroupChallenge(selectedGroup._id, { name, days, startDate, habits });
    if (result) {
      setGroupChallenge(result);
      setShowChallengeForm(false);
      showToast('Challenge created!');
    } else {
      showToast('Failed to create challenge');
    }
  };

  const isCreator = selectedGroup && String(selectedGroup.createdBy?._id || selectedGroup.createdBy) === String(user._id);
  const isAdmin = user?.role === 'admin';

  if (selectedGroup) {
    return (
      <div className="groups-page">
        <div className="gp-back-bar">
          <button className="gp-back" onClick={() => setSelectedGroup(null)}>&larr; Back</button>
          <h3>{selectedGroup.name}</h3>
          {(isCreator || isAdmin) && (
            <button className="gp-del" onClick={handleDeleteGroup} title="Delete group">&times;</button>
          )}
        </div>

        <div className="gp-members">
          <span className="gp-members-label">
            {selectedGroup.members.length} member{selectedGroup.members.length !== 1 ? 's' : ''}
          </span>
          {(isCreator || isAdmin) && (
            <button className="gp-add-member-btn" onClick={() => setShowAddMember(true)}>+ Add</button>
          )}
          <div className="gp-avatar-row">
            {selectedGroup.members.map(m => (
              <div key={m._id} className="gp-avatar-item">
                <div className="gp-mini-avatar">
                  {m.profilePicture ? <img src={m.profilePicture} alt="" /> : (m.username[0] || '?').toUpperCase()}
                </div>
                <span className="gp-mini-name">{m.username}</span>
                {(isCreator || isAdmin) && String(m._id) !== String(user._id) && (
                  <button className="gp-remove-member" onClick={() => handleRemoveMember(m._id)}>&times;</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {showAddMember && (
          <form className="gp-add-form" onSubmit={handleAddMember}>
            <input value={memberInput} onChange={e => setMemberInput(e.target.value)} placeholder="Enter username" />
            <button type="submit">Add</button>
            <button type="button" onClick={() => setShowAddMember(false)}>Cancel</button>
          </form>
        )}

        <div className="gp-challenge-section">
          {groupChallenge ? (
            <div className="gp-challenge-card">
              <strong>{groupChallenge.name}</strong>
              <span className="gp-challenge-meta">{groupChallenge.habitsCount} habits &middot; {groupChallenge.days} days</span>
              {(isCreator || isAdmin) && (
                <button className="gp-edit-challenge-btn" onClick={() => setShowChallengeForm(true)}>Edit</button>
              )}
            </div>
          ) : (
            (isCreator || isAdmin) && (
              <button className="gp-create-challenge-btn" onClick={() => setShowChallengeForm(true)}>
                + Create Group Challenge
              </button>
            )
          )}
        </div>

        {showChallengeForm && (
          <form className="gp-challenge-form" onSubmit={handleCreateChallenge}>
            <input name="name" defaultValue={groupChallenge?.name || ''} placeholder="Challenge name" required />
            <input name="days" type="number" defaultValue={groupChallenge?.days || 30} min="1" placeholder="Duration (days)" required />
            <input name="startDate" type="date" defaultValue={groupChallenge?.startDate || new Date().toISOString().slice(0, 10)} required />
            <div className="gp-habits-list">
              <label>Habits:</label>
              {[1, 2, 3, 4].map(i => (
                <input key={i} className="gh-habit-input" defaultValue={groupChallenge?.habits?.[i - 1]?.name || ''} placeholder={'Habit ' + i} />
              ))}
            </div>
            <button type="submit">{groupChallenge ? 'Update' : 'Create'}</button>
            <button type="button" onClick={() => setShowChallengeForm(false)}>Cancel</button>
          </form>
        )}

        <div className="gp-messages">
          {messages.map(msg => (
            <div key={msg._id} className={`gp-msg ${String(msg.sender?._id || msg.sender) === String(user._id) ? 'own' : ''}`}>
              <div className="gp-msg-sender">{msg.sender?.username || 'Unknown'}</div>
              <div className="gp-msg-text">{msg.text}</div>
              <div className="gp-msg-time">{new Date(msg.createdAt).toLocaleString()}</div>
            </div>
          ))}
          <div ref={msgEndRef} />
        </div>

        <div className="gp-input-bar">
          <input value={msgText} onChange={e => setMsgText(e.target.value)} placeholder="Type a message..." onKeyDown={e => { if (e.key === 'Enter') sendMessage(); }} />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    );
  }

  return (
    <div className="groups-page">
      <div className="gp-header">
        <h2>Groups</h2>
        {isAdmin && <button className="gp-create-btn" onClick={() => setShowCreate(true)}>+ New Group</button>}
      </div>

      {showCreate && (
        <form className="gp-create-form" onSubmit={handleCreateGroup}>
          <input name="name" placeholder="Group name" required />
          <button disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
          <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>No groups yet</p>
          {isAdmin && <p style={{ fontSize: '12px', color: 'var(--text2)' }}>Create a group to get started</p>}
        </div>
      ) : (
        <div className="gp-list">
          {groups.map(g => (
            <div key={g._id} className="gp-card" onClick={() => openGroup(g)}>
              <div className="gp-card-info">
                <div className="gp-card-name">{g.name}</div>
                <div className="gp-card-meta">
                  {g.members?.length || 0} members &middot; Created by {g.createdBy?.username || 'Unknown'}
                </div>
              </div>
              <div className="gp-card-arrow">&rsaquo;</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
