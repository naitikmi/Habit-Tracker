import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../Layout/Toast';
import {
  loadGroups, createGroup, getGroup, addGroupMembers, removeGroupMember,
  getGroupChallenge, sendGroupMessage, loadGroupMessages,
  deleteGroup, loadDiscoverableGroups, joinGroup, leaveGroup
} from '../../utils/api';
import ChallengeWizard from '../Settings/ChallengeWizard';

export default function GroupsPage() {
  const { user } = useAuth();
  const { refreshData } = useData();
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
  const [discoverGroups, setDiscoverGroups] = useState([]);
  const msgEndRef = useRef(null);

  useEffect(() => {
    loadGroups().then(setGroups);
    loadDiscoverableGroups().then(setDiscoverGroups);
  }, []);

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
    if (!name) { showToast('Enter a tribe name'); return; }
    setCreating(true);
    const g = await createGroup(name, []);
    if (g) {
      setGroups(prev => [g, ...prev]);
      setShowCreate(false);
      showToast('Tribe created!');
    } else {
      showToast('Failed to create tribe');
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

  const handleJoin = async (groupId) => {
    const updated = await joinGroup(groupId);
    if (updated) {
      setGroups(prev => [updated, ...prev]);
      setDiscoverGroups(prev => prev.filter(g => g._id !== groupId));
      showToast('Joined tribe!');
      refreshData();
    }
  };

  const handleLeave = async (groupId) => {
    const updated = await leaveGroup(groupId);
    if (updated) {
      setGroups(prev => prev.filter(g => g._id !== groupId));
      setDiscoverGroups(prev => [...prev, updated]);
      setSelectedGroup(null);
      showToast('Left tribe');
      refreshData();
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Delete this tribe and its challenge?')) return;
    const ok = await deleteGroup(selectedGroup._id);
    if (ok) {
      setGroups(prev => prev.filter(g => g._id !== selectedGroup._id));
      setSelectedGroup(null);
      showToast('Tribe deleted');
      refreshData();
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
          <button className="gp-leave-btn" onClick={() => handleLeave(selectedGroup._id)} title="Leave tribe">Leave</button>
          {(isCreator || isAdmin) && (
            <button className="gp-del" onClick={handleDeleteGroup} title="Delete tribe">&times;</button>
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
              <span className="gp-challenge-meta">{groupChallenge.habitsCount ?? groupChallenge.habits?.length ?? 0} habits &middot; {groupChallenge.days} days</span>
              {(isCreator || isAdmin) && (
                <button className="gp-edit-challenge-btn" onClick={() => setShowChallengeForm(true)}>Edit</button>
              )}
            </div>
          ) : (
            (isCreator || isAdmin) && (
              <button className="gp-create-challenge-btn" onClick={() => setShowChallengeForm(true)}>
                + Create Tribe Challenge
              </button>
            )
          )}
        </div>

        {showChallengeForm && (
          <ChallengeWizard
            source="group"
            groupId={selectedGroup._id}
            editChallenge={groupChallenge}
            onCancel={() => setShowChallengeForm(false)}
            onSaved={(result) => { setGroupChallenge(result); refreshData(); }}
          />
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
        <h2>Habit Tribe</h2>
        <button className="gp-create-btn" onClick={() => setShowCreate(true)}>+ New Tribe</button>
      </div>

      {showCreate && (
        <form className="gp-create-form" onSubmit={handleCreateGroup}>
          <input name="name" placeholder="Tribe name" required />
          <button disabled={creating}>{creating ? 'Creating...' : 'Create'}</button>
          <button type="button" onClick={() => setShowCreate(false)}>Cancel</button>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="empty-state">
          <p>No tribes yet</p>
          <p style={{ fontSize: '12px', color: 'var(--text2)' }}>Create a tribe or join one below</p>
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

      {discoverGroups.length > 0 && (
        <>
          <h3 className="gp-section-title">Discover Tribes</h3>
          <div className="gp-list">
            {discoverGroups.map(g => (
              <div key={g._id} className="gp-card gp-card-discover">
                <div className="gp-card-info">
                  <div className="gp-card-name">{g.name}</div>
                  <div className="gp-card-meta">
                    {g.members?.length || 0} members &middot; Created by {g.createdBy?.username || 'Unknown'}
                  </div>
                </div>
                <button className="gp-join-btn" onClick={() => handleJoin(g._id)}>Join</button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
