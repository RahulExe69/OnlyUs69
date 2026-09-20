import React, { useState, useEffect } from 'react';
import { Cloud, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles, ExternalLink, ShieldCheck, Loader2 } from 'lucide-react';
import { CloudinaryAccount, getCloudinaryAccounts, saveCloudinaryAccounts } from '../lib/cloudinary';

export const CloudinarySettingsSection: React.FC = () => {
  const [accounts, setAccounts] = useState<CloudinaryAccount[]>(() => getCloudinaryAccounts());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCloudName, setNewCloudName] = useState('');
  const [newUploadPreset, setNewUploadPreset] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [testStatus, setTestStatus] = useState<{ [id: string]: 'testing' | 'success' | 'failed' }>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync listener if updated remotely via app_config or another tab
  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (Array.isArray(e.detail)) {
        setAccounts(e.detail);
      }
    };
    window.addEventListener('onlyus_cloudinary_updated', handleUpdate);
    return () => window.removeEventListener('onlyus_cloudinary_updated', handleUpdate);
  }, []);

  const handleToggleAccount = (id: string) => {
    const updated = accounts.map(acc => acc.id === id ? { ...acc, isActive: !acc.isActive } : acc);
    setAccounts(updated);
    saveCloudinaryAccounts(updated, true);
  };

  const handleDeleteAccount = (id: string) => {
    const updated = accounts.filter(acc => acc.id !== id);
    setAccounts(updated);
    saveCloudinaryAccounts(updated, true);
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const cName = newCloudName.trim();
    const preset = newUploadPreset.trim();
    if (!cName || !preset) return;

    const newAcc: CloudinaryAccount = {
      id: `cloud_${Date.now()}`,
      cloudName: cName,
      uploadPreset: preset,
      label: newLabel.trim() || `Vault ${accounts.length + 1}`,
      isActive: true,
    };

    const updated = [...accounts, newAcc];
    setAccounts(updated);
    await saveCloudinaryAccounts(updated, true);
    setNewCloudName('');
    setNewUploadPreset('');
    setNewLabel('');
    setShowAddForm(false);
    setStatusMessage(`Saved! Automatically synced to both devices.`);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const testAccount = async (account: CloudinaryAccount) => {
    setTestStatus(prev => ({ ...prev, [account.id]: 'testing' }));
    try {
      // 1x1 transparent PNG blob for ping test
      const testBlob = new Blob(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])],
        { type: 'image/png' }
      );

      const formData = new FormData();
      formData.append('file', testBlob, 'test_ping.png');
      formData.append('upload_preset', account.uploadPreset.trim());

      const res = await fetch(`https://api.cloudinary.com/v1_1/${account.cloudName.trim()}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        setTestStatus(prev => ({ ...prev, [account.id]: 'success' }));
      } else {
        setTestStatus(prev => ({ ...prev, [account.id]: 'failed' }));
      }
    } catch {
      setTestStatus(prev => ({ ...prev, [account.id]: 'failed' }));
    }
    setTimeout(() => {
      setTestStatus(prev => {
        const copy = { ...prev };
        delete copy[account.id];
        return copy;
      });
    }, 4000);
  };

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="p-3.5 rounded-2xl bg-[var(--theme-accent)]/10 border border-[var(--theme-accent)]/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--theme-accent)]/20 text-[var(--theme-accent)] flex items-center justify-center shrink-0">
            <Cloud className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-[var(--theme-text)]">Permanent Cloud Storage</div>
            <div className="text-[10px] text-[var(--theme-text)]/60 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0" />
              <span>Synced across all your devices via secure database</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1.5 rounded-xl bg-[var(--theme-accent)] text-white text-[11px] font-bold shadow-xs hover:opacity-95 active:scale-95 transition-all flex items-center gap-1 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Vault</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 text-xs font-bold rounded-xl flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Add New Account Form */}
      {showAddForm && (
        <form onSubmit={handleAddAccount} className="p-4 rounded-2xl bg-[var(--theme-surface)] border border-[var(--theme-accent)]/30 shadow-md space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[var(--theme-border)]/50 pb-2">
            <h4 className="text-xs font-bold text-[var(--theme-text)] flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-[var(--theme-accent)]" />
              <span>Connect New Cloud Vault</span>
            </h4>
            <a
              href="https://cloudinary.com/users/register_free"
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-[var(--theme-accent)] font-semibold hover:underline flex items-center gap-0.5"
            >
              Get Free Account <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>

          <div className="space-y-2.5">
            <div>
              <label className="text-[10px] font-bold text-[var(--theme-text)]/70 uppercase tracking-wider">Vault Name</label>
              <input
                type="text"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                placeholder="e.g. Primary Vault"
                className="w-full mt-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[var(--theme-accent)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-[var(--theme-text)]/70 uppercase tracking-wider">Cloud Name *</label>
                <input
                  type="text"
                  required
                  value={newCloudName}
                  onChange={e => setNewCloudName(e.target.value)}
                  placeholder="cloud name"
                  className="w-full mt-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--theme-accent)]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-[var(--theme-text)]/70 uppercase tracking-wider">Upload Preset *</label>
                <input
                  type="text"
                  required
                  value={newUploadPreset}
                  onChange={e => setNewUploadPreset(e.target.value)}
                  placeholder="e.g. onlyus_unsigned"
                  className="w-full mt-1 bg-[var(--theme-input-bg)] border border-[var(--theme-border)] text-[var(--theme-text)] rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-[var(--theme-accent)]"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              className="flex-1 py-2 bg-[var(--theme-accent)] text-white text-xs font-bold rounded-xl shadow-xs hover:opacity-95 active:scale-98 transition-all"
            >
              Save & Sync Vault
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 text-xs text-[var(--theme-text)]/60 hover:text-[var(--theme-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Accounts List */}
      <div className="space-y-2">
        {accounts.length === 0 ? (
          <div className="p-6 text-center rounded-2xl border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface)]/40 space-y-2">
            <Cloud className="w-8 h-8 mx-auto text-[var(--theme-text)]/30" />
            <div className="text-xs font-bold text-[var(--theme-text)]">No Cloud Vault Connected Yet</div>
            <p className="text-[11px] text-[var(--theme-text)]/60 max-w-xs mx-auto">
              Tap <b>Add Vault</b> above to connect your free Cloudinary account once. It will automatically sync to both your and Nusrat&apos;s devices.
            </p>
          </div>
        ) : (
          accounts.map((acc, idx) => {
            const status = testStatus[acc.id];
            return (
              <div
                key={acc.id}
                className={`p-3.5 rounded-2xl border transition-all ${
                  acc.isActive
                    ? 'bg-[var(--theme-surface)] border-[var(--theme-border)] shadow-xs'
                    : 'bg-[var(--theme-surface)]/40 border-dashed border-[var(--theme-border)]/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--theme-text)] truncate">
                        {acc.label || `Vault ${idx + 1}`}
                      </span>
                      {acc.isActive ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Active
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-zinc-500/10 text-zinc-500">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-[var(--theme-text)]/60 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Cloud: <b>{acc.cloudName}</b></span>
                      <span>Preset: <b>{acc.uploadPreset}</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => testAccount(acc)}
                      disabled={status === 'testing'}
                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-[var(--theme-border)] hover:bg-[var(--theme-accent)]/10 text-[var(--theme-text)] transition-colors flex items-center gap-1"
                      title="Test cloud upload connection"
                    >
                      {status === 'testing' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {status === 'testing' ? 'Testing' : status === 'success' ? 'Connected' : status === 'failed' ? 'Failed' : 'Test'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleAccount(acc.id)}
                      className="p-1.5 text-[var(--theme-text)]/50 hover:text-[var(--theme-text)]"
                      title={acc.isActive ? 'Disable vault' : 'Enable vault'}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteAccount(acc.id)}
                      className="p-1.5 text-red-400 hover:text-red-600"
                      title="Remove vault"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {status === 'failed' && (
                  <div className="mt-2 text-[10px] text-rose-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>Upload failed. Check if Cloud Name & Preset are spelled correctly.</span>
                  </div>
                )}
                {status === 'success' && (
                  <div className="mt-2 text-[10px] text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span>Connected successfully! Verified upload ready.</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
