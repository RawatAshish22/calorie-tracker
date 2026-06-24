import React, { useState } from 'react';
import { 
  Users, UserPlus, Plus, ChevronRight, ChevronLeft, Activity, 
  Flame, Settings, Copy, LogOut, Link2
} from 'lucide-react';
import { 
  apiCreateGroup, apiJoinGroup, apiGetGroupFeed, apiLeaveGroup 
} from './lib/api.js';

export default function Groups({ user, userGroups, setUserGroups, onToast }) {
  const [view, setView] = useState('list'); // 'list', 'create', 'join', 'detail', 'group-settings', 'group-members'
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  // Group Detail State
  const [feed, setFeed] = useState(null);
  const [loading, setLoading] = useState(false);

  // Create/Join Form State
  const [inputVal, setInputVal] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadFeed(groupId) {
    setLoading(true);
    try {
      const data = await apiGetGroupFeed(groupId);
      setFeed(data);
    } catch (err) {
      onToast(err.message || 'Failed to load group');
    }
    setLoading(false);
  }

  function handleGroupClick(group) {
    setSelectedGroup(group);
    setFeed(null);
    setView('detail');
    loadFeed(group.id);
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setSubmitting(true);
    try {
      const newGroup = await apiCreateGroup(inputVal.trim());
      setUserGroups([...userGroups, newGroup]);
      onToast(`Group "${newGroup.name}" created!`);
      setInputVal('');
      handleGroupClick(newGroup);
    } catch (err) {
      onToast(err.message || 'Failed to create group');
    }
    setSubmitting(false);
  }

  async function handleJoin(e) {
    e.preventDefault();
    if (!inputVal.trim()) return;
    setSubmitting(true);
    try {
      const newGroup = await apiJoinGroup(inputVal.trim().toUpperCase());
      setUserGroups([...userGroups, newGroup]);
      onToast(`Joined "${newGroup.name}"!`);
      setInputVal('');
      handleGroupClick(newGroup);
    } catch (err) {
      onToast(err.message || 'Failed to join group');
    }
    setSubmitting(false);
  }

  async function handleLeave() {
    if (!selectedGroup) return;
    try {
      await apiLeaveGroup(selectedGroup.id);
      setUserGroups(userGroups.filter(g => g.id !== selectedGroup.id));
      onToast(`Left ${selectedGroup.name}`);
      setView('list');
      setShowLeaveConfirm(false);
    } catch (err) {
      onToast(err.message || 'Failed to leave group');
    }
  }

  if (view === 'detail' && selectedGroup) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-white animate-in slide-in-from-right-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <button onClick={() => setView('list')} className="rounded-full p-2 hover:bg-zinc-800">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold">{selectedGroup.name}</h2>
            <div 
              className="flex items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition"
              onClick={() => {
                navigator.clipboard.writeText(selectedGroup.code);
                onToast('Invite code copied to clipboard!');
              }}
            >
              <p className="text-xs text-zinc-400">Code: <span className="font-mono text-emerald-400 text-sm font-bold">{selectedGroup.code}</span></p>
              <Copy className="h-3 w-3 text-emerald-400" />
            </div>
          </div>
          <button onClick={() => { setView('group-settings'); setShowLeaveConfirm(false); }} className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white">
            <Settings className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Members (Moved to Settings) */}

          {/* Activity Feed */}
          <div>
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">Recent Activity</h3>
            {loading && !feed ? (
              <div className="flex justify-center p-8"><Activity className="h-6 w-6 animate-pulse text-zinc-600" /></div>
            ) : feed?.activity?.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <Flame className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                <p className="text-zinc-400">No activity yet.</p>
                <p className="mt-1 text-sm text-zinc-500">Log a burn session to see it here!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(feed?.activity || []).map(item => (
                  <div key={item._id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-zinc-700">
                    <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.userProfilePic ? (
                        <img src={item.userProfilePic} alt={item.userName} className="h-7 w-7 rounded-full object-cover border border-emerald-500/40" />
                      ) : (
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
                          {item.userName.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="font-semibold">{item.userName}</span>
                    </div>
                      <span className="text-xs text-zinc-500">
                        {new Date(item.postedAt).toLocaleString(undefined, {
                          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4 rounded-xl bg-black/40 p-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                        <Flame className="h-5 w-5 text-emerald-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-emerald-400">{item.calories} kcal burned</h4>
                        <p className="text-sm text-zinc-400">{item.modeName} • {item.summary}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (view === 'group-settings' && selectedGroup) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-white animate-in slide-in-from-right-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <button onClick={() => setView('detail')} className="rounded-full p-2 hover:bg-zinc-800">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold">Group Settings</h2>
            <p className="text-xs text-zinc-400">{selectedGroup.name}</p>
          </div>
          <div className="w-10"></div> {/* Placeholder for flex centering */}
        </div>

        {/* Content */}
        <div className="flex-1 p-4 space-y-4">
          <button
            onClick={() => {
              const link = `${window.location.origin}?invite=${selectedGroup.inviteToken}`;
              navigator.clipboard.writeText(link);
              onToast('Invite link copied to clipboard!');
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Link2 className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-white">Copy Invite Link</h4>
              <p className="text-sm text-zinc-400">Share with anyone to join instantly</p>
            </div>
          </button>

          <button
            onClick={() => setView('group-members')}
            className="flex w-full items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h4 className="font-bold text-white">Check Group Members</h4>
              <p className="text-sm text-zinc-400">See everyone in this group</p>
            </div>
          </button>

          {!showLeaveConfirm ? (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="flex w-full items-center gap-4 rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 text-left transition-all hover:border-rose-500/50 hover:bg-rose-500/10"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400">
                <LogOut className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-rose-400">Leave Group</h4>
                <p className="text-sm text-rose-500/70">Remove yourself from this group</p>
              </div>
            </button>
          ) : (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-center animate-in fade-in zoom-in-95">
              <LogOut className="mx-auto mb-3 h-8 w-8 text-rose-400" />
              <h4 className="mb-1 font-bold text-white">Leave {selectedGroup.name}?</h4>
              <p className="mb-5 text-sm text-zinc-400">You will no longer see this group's activity or members.</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="rounded-xl bg-zinc-800 py-2.5 font-bold text-white hover:bg-zinc-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleLeave}
                  className="rounded-xl bg-rose-500 py-2.5 font-bold text-white hover:bg-rose-600 transition"
                >
                  Yes, Leave
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (view === 'group-members' && selectedGroup) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-white animate-in slide-in-from-right-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <button onClick={() => setView('group-settings')} className="rounded-full p-2 hover:bg-zinc-800">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="text-center">
            <h2 className="text-lg font-bold">{selectedGroup.name}</h2>
            <p className="text-xs text-zinc-400">Members</p>
          </div>
          <div className="w-10"></div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {(feed?.members || []).map(m => (
            <div key={m.userId} className="flex items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
              {m.profilePic ? (
                <img src={m.profilePic} alt={m.name} className="h-12 w-12 shrink-0 rounded-full object-cover border-2 border-emerald-500/40" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-lg font-bold text-emerald-400">
                  {m.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <span className="font-bold text-white">{m.name}</span>
                <p className="text-xs text-zinc-400">Joined {new Date(m.joinedAt || Date.now()).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'create' || view === 'join') {
    const isCreate = view === 'create';
    return (
      <div className="flex h-full flex-col bg-zinc-950 p-4 animate-in slide-in-from-bottom-4">
        <button onClick={() => setView('list')} className="mb-6 self-start rounded-full p-2 hover:bg-zinc-800 text-zinc-400">
          <ChevronLeft className="h-6 w-6" />
        </button>
        
        <div className="mx-auto w-full max-w-sm flex-1">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10">
              {isCreate ? <Plus className="h-8 w-8 text-emerald-400" /> : <UserPlus className="h-8 w-8 text-emerald-400" />}
            </div>
            <h2 className="text-2xl font-bold text-white">{isCreate ? 'Create a Group' : 'Join a Group'}</h2>
            <p className="mt-2 text-zinc-400">
              {isCreate ? 'Create a space for your friends or family.' : 'Enter the 6-character invite code.'}
            </p>
          </div>

          <form onSubmit={isCreate ? handleCreate : handleJoin} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-400">
                {isCreate ? 'Group Name' : 'Invite Code'}
              </label>
              <input
                type="text"
                required
                maxLength={isCreate ? 50 : 6}
                value={inputVal}
                onChange={(e) => setInputVal(isCreate ? e.target.value : e.target.value.toUpperCase())}
                placeholder={isCreate ? "e.g. Weekend Warriors" : "e.g. A1B2C3"}
                className={`w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${!isCreate && 'font-mono uppercase tracking-widest text-center text-xl'}`}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-emerald-500 py-3.5 font-bold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {submitting ? 'Please wait...' : isCreate ? 'Create Group' : 'Join Group'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 p-4">
      <div className="mb-6 pt-2">
        <h1 className="text-2xl font-black text-white">Groups</h1>
        <p className="text-sm text-zinc-400">Track calorie burns together</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <button
          onClick={() => { setView('create'); setInputVal(''); }}
          className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
        >
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-400">
            <Plus className="h-6 w-6" />
          </div>
          <span className="font-bold text-white">Create</span>
        </button>
        <button
          onClick={() => { setView('join'); setInputVal(''); }}
          className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-zinc-800 bg-zinc-900 p-4 transition-all hover:border-emerald-500/50 hover:bg-zinc-800"
        >
          <div className="rounded-full bg-emerald-500/10 p-3 text-emerald-400">
            <UserPlus className="h-6 w-6" />
          </div>
          <span className="font-bold text-white">Join</span>
        </button>
      </div>

      <div className="flex-1">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-zinc-400">My Groups</h3>
        {userGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 p-8 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
            <p className="text-sm text-zinc-400">You aren't in any groups yet.<br/>Create or join one above!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {userGroups.map((group) => (
              <button
                key={group.id}
                onClick={() => handleGroupClick(group)}
                className="flex w-full items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-4 text-left transition-all hover:border-zinc-700"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{group.name}</h4>
                    <p className="text-sm text-zinc-400">{group.memberCount} members</p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-600" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
