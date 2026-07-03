import React, { useState, useEffect } from 'react';
import { useData } from '../../contexts/DataContext';
import { saveDefaultsToServer, saveUserChallenges } from '../../utils/api';
import { todayStr, COLORS } from '../../utils/helpers';
import { useToast } from '../Layout/Toast';

export default function ChallengeWizard({ editChallenge, source, onCancel }) {
  const { defaultsData, setDefaultsData, userChallengesData, setUserChallengesData, refreshData } = useData();
  const { showToast } = useToast();

  const [name, setName] = useState(editChallenge ? editChallenge.name : 'My 30-Day Challenge');
  const [days, setDays] = useState(editChallenge ? editChallenge.days : 30);
  const [startDate, setStartDate] = useState(editChallenge ? editChallenge.startDate : todayStr());
  const [habits, setHabits] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editChallenge && editChallenge.habits && editChallenge.habits.length) {
      setHabits(editChallenge.habits.map(h => ({ name: h.name, maxPoints: h.maxPoints || 10 })));
    } else {
      setHabits([
        { name: '', maxPoints: 10 },
        { name: '', maxPoints: 10 },
        { name: '', maxPoints: 10 }
      ]);
    }
  }, [editChallenge]);

  const updateHabit = (index, field, value) => {
    const updated = [...habits];
    updated[index] = { ...updated[index], [field]: field === 'maxPoints' ? Number(value) : value };
    setHabits(updated);
  };

  const addHabit = () => {
    setHabits([...habits, { name: '', maxPoints: 10 }]);
  };

  const removeHabit = (index) => {
    if (habits.length <= 1) {
      showToast('Need at least 1 habit');
      return;
    }
    setHabits(habits.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name.trim()) { showToast('Enter a challenge name'); return; }
    if (!days || days < 1) { showToast('Enter valid days'); return; }
    if (!startDate) { showToast('Select a start date'); return; }

    const habitList = [];
    for (const h of habits) {
      if (!h.name.trim()) { showToast('Enter a name for each habit'); return; }
      habitList.push({
        name: h.name.trim(),
        maxPoints: Math.max(1, h.maxPoints || 10)
      });
    }

    const store = source === 'user' ? userChallengesData : defaultsData;
    let target = store;
    if (!target) {
      target = { challenges: [], activeChallengeId: null, nextChallengeId: 1 };
    }
    if (!target.challenges) target.challenges = [];
    if (!target.nextChallengeId) target.nextChallengeId = (target.challenges.length || 0) + 1;

    const colorIdx = habitList.length;
    const finalHabits = habitList.map((h, i) => ({
      id: i + 1,
      name: h.name,
      maxPoints: h.maxPoints,
      color: COLORS[i % COLORS.length]
    }));

    if (editChallenge) {
      editChallenge.name = name.trim();
      editChallenge.days = days;
      editChallenge.startDate = startDate;
      editChallenge.habits = finalHabits;
      editChallenge.nextHabitId = finalHabits.length + 1;
    } else {
      const newId = target.nextChallengeId++;
      target.challenges.push({
        id: newId,
        name: name.trim(),
        days,
        startDate,
        habits: finalHabits,
        nextHabitId: finalHabits.length + 1
      });
      target.activeChallengeId = newId;
    }

    const newData = { ...target };
    if (source === 'user') {
      setUserChallengesData(newData);
      await saveUserChallenges(newData);
    } else {
      setDefaultsData(newData);
      await saveDefaultsToServer(newData);
    }

    showToast(editChallenge ? 'Challenge updated!' : 'Challenge created!');
    onCancel();
  };

  const isEdit = !!editChallenge;
  const title = isEdit ? 'Edit Challenge' : (source === 'user' ? 'Create My Challenge' : 'Create Default Challenge');

  return (
    <div className="wizard">
      <h2>{title}</h2>
      <label>Challenge Name</label>
      <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength="50" />
      <label>Duration (days)</label>
      <input type="number" value={days} onChange={e => setDays(Number(e.target.value))} min="1" max="999" />
      <label>Start Date</label>
      <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
      <div className="wizard-habits">
        <div className="wh-title">Habits</div>
        <div id="wizHabitList">
          {habits.map((h, i) => (
            <div className="wh-row" key={i}>
              <input
                type="text"
                placeholder="Habit name"
                value={h.name}
                onChange={e => updateHabit(i, 'name', e.target.value)}
                maxLength="40"
              />
              <input
                type="number"
                value={h.maxPoints}
                onChange={e => updateHabit(i, 'maxPoints', e.target.value)}
                min="1"
                max="999"
              />
              <button className="btn-wh-del" onClick={() => removeHabit(i)}>&#10005;</button>
            </div>
          ))}
        </div>
        <button className="btn-wh-add" onClick={addHabit}>+ Add Habit</button>
      </div>
      <button className="btn-wiz-save" onClick={handleSave}>
        {isEdit ? 'Save Changes' : 'Create Challenge'}
      </button>
      <button className="btn-wiz-save" onClick={onCancel} style={{ background: 'var(--card2)', color: 'var(--text)', marginTop: '6px' }}>
        Cancel
      </button>
      {error && <div style={{ color: 'var(--red)', fontSize: '12px', marginTop: '8px', textAlign: 'center' }}>{error}</div>}
    </div>
  );
}
