/* oxlint-disable react/set-state-in-effect -- Reset mounted modal state at open/identity boundaries, not on ordinary renders. */
import React, { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmLabel?: string;
  isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  isDanger = false,
}) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (isOpen) setError(null); }, [isOpen]);
  const close = () => { if (!saving) onClose(); };
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      id="confirm-modal-backdrop"
      onClick={close}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="confirm-modal-dialog"
      >
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDanger
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-500'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500'
              }`}
            >
              <AlertTriangle size={17} />
            </div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">{title}</h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={close}
            aria-label="Close"
            id="close-confirm-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {message}
          </p>
          {error && <p role="alert" className="text-sm text-rose-500 mt-3">{error}</p>}
        </div>

        <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
            onClick={close}
            id="cancel-confirm-btn"
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white transition-all shadow-md cursor-pointer ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/25'
                : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/25'
            }`}
            disabled={saving}
            onClick={async () => {
              if (saving) return;
              setSaving(true); setError(null);
              try { await onConfirm(); onClose(); }
              catch (failure) { setError(failure instanceof Error ? failure.message : 'Change failed'); }
              finally { setSaving(false); }
            }}
            id="proceed-confirm-btn"
          >
            {saving ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
