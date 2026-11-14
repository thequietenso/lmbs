/* oxlint-disable react/set-state-in-effect, react/only-export-components -- Session boundaries reset transient UI; this module intentionally exports the context hook. */
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useSyncExternalStore } from 'react';
import { io } from 'socket.io-client';
import type { Book, BookFormData, Member, MemberFormData, Loan, ToastMessage, BackendSyncState, LibraryStats } from '../types';
import { INITIAL_BOOKS, INITIAL_MEMBERS, INITIAL_LOANS, INITIAL_ACTIVITIES } from '../services/seedData';
import { apiService } from '../services/api';
import { LibraryStore, type LibrarySnapshot } from './libraryStore';

interface LibraryContextType extends LibrarySnapshot {
  now: number;
  theme: 'dark' | 'light'; toggleTheme: () => void;
  searchQuery: string; setSearchQuery: (query: string) => void;
  backendState: BackendSyncState; canManage: boolean; canViewPrivate: boolean;
  realtimeState: 'off' | 'connecting' | 'live' | 'disconnected';
  toasts: ToastMessage[]; addToast: (toast: Omit<ToastMessage, 'id'>) => void; removeToast: (id: string) => void;
  checkBackendConnection: () => Promise<boolean>; syncWithBackend: () => Promise<void>; updateApiUrl: (url: string) => void;
  login: LibraryStore['login']; register: LibraryStore['register']; logout: () => void;
  enterDemo: () => void; enterConnected: () => Promise<void>;
  addBook: (data: BookFormData) => Promise<Book>;
  updateBook: (id: string, data: Partial<BookFormData>) => Promise<Book>;
  deleteBook: (id: string) => Promise<void>; getBookById: (id: string) => Book | undefined;
  addMember: (data: MemberFormData) => Promise<Member>;
  updateMember: (id: string, data: Partial<MemberFormData>) => Promise<Member>;
  deleteMember: (id: string) => Promise<void>; getMemberById: (id: string) => Member | undefined;
  issueBook: (bookId: string, memberId: string, days?: number, notes?: string) => Promise<Loan>;
  returnBook: (id: string) => Promise<void>; renewLoan: (id: string, days?: number) => Promise<void>;
  resetToDemoData: () => void; exportCatalogJson: () => void; exportCatalogCsv: () => void; stats: LibraryStats;
}
const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [store] = useState(() => new LibraryStore(apiService, { books: INITIAL_BOOKS, members: INITIAL_MEMBERS, loans: INITIAL_LOANS, activities: INITIAL_ACTIVITIES }));
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => localStorage.getItem('lmbs_theme') === 'light' ? 'light' : 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [realtimeState, setRealtimeState] = useState<LibraryContextType['realtimeState']>('off');
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = crypto.randomUUID(); setToasts(previous => [...previous, { ...toast, id }]);
    setTimeout(() => setToasts(previous => previous.filter(item => item.id !== id)), 5000);
  }, []);
  useEffect(() => { void store.start(); }, [store]);
  useEffect(() => {
    localStorage.setItem('lmbs_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    setSearchQuery(''); setToasts([]);
  }, [state.mode, state.user?.id, state.apiUrl]);
  useEffect(() => {
    const token = apiService.getSession()?.access_token;
    if (state.mode !== 'connected' || !state.user || !token) { setRealtimeState('off'); return; }
    setRealtimeState('connecting');
    // Notification-only: socket payloads are never trusted as application data.
    const socket = io(new URL(state.apiUrl).origin, { path: '/socket.io', auth: { token }, reconnectionAttempts: 5 });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void store.sync().catch(() => { /* store exposes the refresh failure */ }); }, 150);
    };
    socket.on('connect', () => { setRealtimeState('live'); invalidate(); });
    socket.on('disconnect', () => setRealtimeState('disconnected'));
    socket.on('connect_error', () => setRealtimeState('disconnected'));
    socket.onAny((event: string) => {
      if (/^(book|member|loan|activity|genre|review)\.(created|updated|deleted)$/.test(event) || event === 'sync.request') invalidate();
    });
    return () => { clearTimeout(timer); socket.removeAllListeners(); socket.disconnect(); };
  }, [store, state.mode, state.user, state.apiUrl]);

  const notify = async <T,>(operation: () => Promise<T>, title: string): Promise<T> => {
    try {
      const result = await operation();
      const current = store.getSnapshot();
      addToast({ type: current.error ? 'warning' : 'success', title: `${current.mode === 'demo' ? 'Demo: ' : ''}${title}`, message: current.error || (current.mode === 'demo' ? 'Saved in this browser only. No server changes.' : 'Server confirmed the change.') });
      return result;
    } catch (error) {
      addToast({ type: 'error', title: 'Change not completed', message: error instanceof Error ? error.message : 'Request failed' }); throw error;
    }
  };
  const stats = useMemo<LibraryStats>(() => {
    const active = state.loans.filter(loan => loan.status !== 'returned');
    const today = new Date(now).toISOString().slice(0, 10);
    const overdue = active.filter(loan => loan.dueDate < today || loan.status === 'overdue');
    return {
      totalBooks: state.bookStats?.totalBooks ?? state.books.length,
      totalCopies: state.bookStats?.totalCopies ?? state.books.reduce((sum, book) => sum + book.totalCopies, 0),
      availableCopies: state.bookStats?.availableCopies ?? state.books.reduce((sum, book) => sum + book.availableCopies, 0),
      activeLoansCount: state.loanStats?.activeLoans ?? active.length,
      overdueLoansCount: state.loanStats?.overdueLoans ?? overdue.length,
      totalMembers: state.members.length,
      totalFinesPending: state.loanStats?.totalFines ?? Number(overdue.reduce((sum, loan) => sum + (loan.fineAmount ?? Math.max(0, Math.floor((now - new Date(loan.dueDate).getTime()) / 86400000)) * 0.5), 0).toFixed(2)),
    };
  }, [state, now]);
  const download = (content: string, type: string, extension: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `lmbs-${state.mode}-catalog-${new Date().toISOString().slice(0, 10)}.${extension}`;
    anchor.click(); URL.revokeObjectURL(url);
  };
  const canViewPrivate = state.mode === 'demo' || ['admin','librarian'].includes(state.user?.role || '');
  const canManage = canViewPrivate && !state.pending && !state.authPending && !state.needsSync;
  return <LibraryContext.Provider value={{
    ...state, now, theme, toggleTheme: () => setTheme(previous => previous === 'dark' ? 'light' : 'dark'), searchQuery, setSearchQuery,
    backendState: { apiUrl: state.apiUrl, isConnected: state.isConnected, isChecking: state.isChecking, lastSyncedAt: state.lastSyncedAt, error: state.error, syncMode: 'manual' },
    canManage, canViewPrivate, realtimeState, toasts, addToast, removeToast: id => setToasts(previous => previous.filter(item => item.id !== id)),
    checkBackendConnection: store.checkConnection, syncWithBackend: store.sync, updateApiUrl: store.updateApiUrl,
    login: store.login, register: store.register, logout: store.logout, enterDemo: store.enterDemo, enterConnected: store.enterConnected,
    addBook: data => notify(() => store.addBook(data), 'Book added'), updateBook: (id, data) => notify(() => store.updateBook(id, data), 'Book updated'),
    deleteBook: id => notify(() => store.deleteBook(id), 'Book removed'), getBookById: id => state.books.find(book => book._id === id),
    addMember: data => notify(() => store.addMember(data), 'Patron registered'), updateMember: (id, data) => notify(() => store.updateMember(id, data), 'Patron updated'),
    deleteMember: id => notify(() => store.deleteMember(id), 'Patron removed'), getMemberById: id => state.members.find(member => member.id === id),
    issueBook: (bookId, memberId, days, notes) => notify(() => store.issueBook(bookId, memberId, days, notes), 'Book issued'),
    returnBook: id => notify(() => store.returnBook(id), 'Book returned'), renewLoan: (id, days) => notify(() => store.renewLoan(id, days), 'Loan renewed'),
    resetToDemoData: store.resetDemo,
    exportCatalogJson: () => download(JSON.stringify(state.books, null, 2), 'application/json', 'json'),
    exportCatalogCsv: () => {
      const keys = ['_id','title','author','genre','pages','publishedYear','isbn','availableCopies','totalCopies','shelfLocation'] as const;
      // Prefix spreadsheet formulas even when quoted to keep exported catalog text inert.
      const cell = (value: unknown) => { const text = String(value ?? ''); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" + text : text).replace(/"/g, '""')}"`; };
      download([keys.join(','), ...state.books.map(book => keys.map(key => cell(book[key])).join(','))].join('\r\n'), 'text/csv', 'csv');
    }, stats,
  }}>{children}</LibraryContext.Provider>;
};
export const useLibrary = (): LibraryContextType => {
  const context = useContext(LibraryContext);
  if (!context) throw new Error('useLibrary must be used within a LibraryProvider');
  return context;
};
