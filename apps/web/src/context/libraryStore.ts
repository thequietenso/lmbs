import type { LibraryApiService } from '../services/api';
import type { Book, BookFormData, Member, MemberFormData, Loan, ActivityItem, Genre, UserIdentity } from '../types';
import type { BookStats, LoanStats } from '@lmbs/shared';

export interface LibraryData { books: Book[]; members: Member[]; loans: Loan[]; activities: ActivityItem[] }
export interface LibrarySnapshot extends LibraryData {
  mode: 'demo' | 'connected';
  user: UserIdentity | null;
  genres: Genre[];
  apiUrl: string;
  isConnected: boolean;
  isChecking: boolean;
  pending: boolean;
  authPending: boolean;
  needsSync: boolean;
  error: string | null;
  lastSyncedAt: string | null;
  bookStats: BookStats | null;
  loanStats: LoanStats | null;
}
const EMPTY: LibraryData = { books: [], members: [], loans: [], activities: [] };
const DEMO_KEY = 'lmbs_demo_v2';
const message = (error: unknown) => error instanceof Error ? error.message : 'Request failed';
const today = () => new Date().toISOString().slice(0, 10);
const datePlus = (date: string, days: number) => new Date(new Date(date).getTime() + days * 86400000).toISOString().slice(0, 10);

/** The only state boundary allowed to write demo storage or replace connected data. */
export class LibraryStore {
  private state: LibrarySnapshot;
  private listeners = new Set<() => void>();
  private epoch = 0;
  private syncSequence = 0;
  private mutationPending = false;
  private startPromise: Promise<void> | undefined;
  private demo: LibraryData;
  constructor(private api: LibraryApiService, private initial: LibraryData, private storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
    // Legacy versions cached connected and demo data together. Never import that cache.
    for (const key of ['lmbs_books', 'lmbs_members', 'lmbs_loans', 'lmbs_activities']) storage.removeItem(key);
    this.demo = structuredClone(initial);
    try {
      const saved = JSON.parse(storage.getItem(DEMO_KEY) || 'null');
      if (saved && ['books','members','loans','activities'].every(key => Array.isArray(saved[key]))) this.demo = saved;
    } catch { storage.removeItem(DEMO_KEY); }
    this.state = {
      ...(api.getSession() ? structuredClone(EMPTY) : this.demo), mode: api.getSession() ? 'connected' : 'demo',
      user: null, genres: [], apiUrl: api.getBaseUrl(), isConnected: false, isChecking: false,
      pending: false, authPending: !!api.getSession(), needsSync: false, error: null, lastSyncedAt: null, bookStats: null, loanStats: null,
    };
    api.onSessionExpired(() => { this.clearConnected(); this.patch({ error: 'Session expired. Sign in again to continue.' }); });
  }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private patch(changes: Partial<LibrarySnapshot>) {
    this.state = { ...this.state, ...changes };
    for (const listener of this.listeners) listener();
  }
  private commitDemo(changes: Partial<LibraryData>) {
    this.demo = { ...this.demo, ...changes };
    this.storage.setItem(DEMO_KEY, JSON.stringify(this.demo));
    this.patch(changes);
  }
  private clearConnected() {
    this.epoch++; this.syncSequence++; this.mutationPending = false;
    this.patch({ ...structuredClone(EMPTY), user: null, genres: [], mode: 'connected', pending: false,
      authPending: false, needsSync: false, isChecking: false, lastSyncedAt: null, bookStats: null, loanStats: null, error: null });
  }
  private assertCurrent(epoch: number) { if (epoch !== this.epoch) throw new Error('Session or server changed. Please retry.'); }
  private requireManagement() {
    if (this.state.needsSync) throw new Error('Sync before making further changes; the previous change was saved on the server.');
    if (this.state.authPending || (this.state.mode === 'connected' && !['admin','librarian'].includes(this.state.user?.role || ''))) {
      throw new Error('Staff sign-in required. Open Settings to sign in.');
    }
  }
  private activity(type: ActivityItem['type'], title: string, description: string) {
    return [{ id: crypto.randomUUID(), type, title, description, timestamp: new Date().toISOString() }, ...this.state.activities].slice(0, 100);
  }
  start = () => this.startPromise ??= this.restoreSession();
  private restoreSession = async () => {
    const session = this.api.getSession();
    if (!session) return;
    const epoch = this.epoch;
    try {
      const user = await this.api.me(); this.assertCurrent(epoch);
      this.api.setSession({ ...session, user });
      this.patch({ user, authPending: false });
      await this.sync();
    } catch (error) {
      if (epoch === this.epoch) { this.api.clearSession(); this.clearConnected(); this.patch({ error: message(error) }); }
    }
  };
  checkConnection = async () => {
    const epoch = this.epoch;
    this.patch({ isChecking: true });
    const result = await this.api.checkConnection();
    if (epoch === this.epoch) this.patch({ isChecking: false, isConnected: result.connected, error: result.error || null });
    return result.connected;
  };
  enterConnected = async () => {
    this.api.clearSession(); this.clearConnected();
    await this.sync();
  };
  enterDemo = () => {
    this.api.clearSession(); this.epoch++; this.syncSequence++; this.mutationPending = false;
    this.patch({ ...this.demo, mode: 'demo', user: null, genres: [], pending: false, authPending: false, isChecking: false,
      error: null, needsSync: false, lastSyncedAt: null, bookStats: null, loanStats: null });
  };
  logout = () => { this.api.clearSession(); this.clearConnected(); };
  updateApiUrl = (url: string) => {
    const previous = this.api.getBaseUrl();
    this.api.setBaseUrl(url);
    if (this.api.getBaseUrl() !== previous) {
      if (this.state.mode === 'connected') this.clearConnected();
      else { this.epoch++; this.syncSequence++; }
      this.patch({ apiUrl: this.api.getBaseUrl(), isConnected: false, lastSyncedAt: null, error: null });
    }
  };
  private authenticate = async (data: { email: string; password: string; name?: string }, register = false) => {
    this.api.clearSession(); this.clearConnected(); this.patch({ authPending: true });
    const epoch = this.epoch;
    try {
      const session = register ? await this.api.register({ ...data, name: data.name || '' }) : await this.api.login(data);
      this.assertCurrent(epoch); this.api.setSession(session); this.patch({ user: session.user, authPending: false });
      // Authentication succeeded even if refresh fails: report refresh separately, not as failed sign-in.
      try { await this.sync(); } catch { /* sync owns the visible error */ }
    } catch (error) {
      if (epoch === this.epoch) this.patch({ authPending: false, error: message(error) });
      throw error;
    }
  };
  login = (data: { email: string; password: string }) => this.authenticate(data);
  register = (data: { email: string; password: string; name: string }) => this.authenticate(data, true);

  sync = async () => {
    if (this.state.mode !== 'connected') throw new Error('Choose Connected mode in Settings before syncing. Demo changes are never uploaded.');
    const epoch = this.epoch;
    const sequence = ++this.syncSequence;
    const staff = ['admin','librarian'].includes(this.state.user?.role || '');
    this.patch({ isChecking: true, error: null });
    try {
      const [books, genres, members, loans, activities, bookStats, loanStats] = await Promise.all([
        this.api.getBooks(), this.api.getGenres(),
        staff ? this.api.getMembers() : [], staff ? this.api.getLoans() : [], staff ? this.api.getActivities() : [],
        staff ? this.api.getBookStats() : null, staff ? this.api.getLoanStats() : null,
      ]);
      this.assertCurrent(epoch);
      if (sequence !== this.syncSequence) return;
      this.patch({ books, genres, members, loans, activities, bookStats: bookStats as BookStats | null, loanStats: loanStats as LoanStats | null,
        isChecking: false, needsSync: false, isConnected: true, lastSyncedAt: new Date().toLocaleTimeString(), error: null });
    } catch (error) {
      if (epoch === this.epoch && sequence === this.syncSequence) this.patch({ isChecking: false, isConnected: false, error: message(error) });
      throw error;
    }
  };

  private async mutate<T>(operation: (connected: boolean) => Promise<T> | T): Promise<T> {
    this.requireManagement();
    if (this.mutationPending) throw new Error('Another change is being saved. Please wait.');
    const epoch = this.epoch;
    const connected = this.state.mode === 'connected';
    this.mutationPending = true; this.patch({ pending: true, error: null });
    try {
      const result = await operation(connected); this.assertCurrent(epoch);
      if (connected) {
        // A confirmed write remains unreconciled until a winning snapshot commits.
        // A superseded refresh returning early is not proof that the write is visible.
        this.patch({ needsSync: true });
        try { await this.sync(); }
        catch (error) {
          this.assertCurrent(epoch);
          this.patch({ needsSync: true, error: `Saved on server, but refresh failed: ${message(error)}. Sync before making further changes.` });
        }
        if (this.state.needsSync) this.patch({ error: `Saved on server, but refresh failed: ${this.state.error || 'Snapshot was superseded'}. Sync before making further changes.` });
      }
      return result;
    } catch (error) {
      if (epoch === this.epoch) this.patch({ error: message(error) });
      throw error;
    } finally {
      if (epoch === this.epoch) { this.mutationPending = false; this.patch({ pending: false }); }
    }
  }
  addBook = (data: BookFormData) => this.mutate(async connected => {
    if (connected) return this.api.createBook(data);
    const book: Book = { ...data, _id: crypto.randomUUID(), availableCopies: data.totalCopies, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    this.commitDemo({ books: [book, ...this.state.books], activities: this.activity('add_book', 'Demo book added', book.title) }); return book;
  });
  updateBook = (id: string, data: Partial<BookFormData>) => this.mutate(async connected => {
    if (connected) return this.api.updateBook(id, data);
    const book = this.state.books.find(item => item._id === id); if (!book) throw new Error('Book not found');
    const totalCopies = data.totalCopies ?? book.totalCopies;
    const availableCopies = book.availableCopies + totalCopies - book.totalCopies;
    if (availableCopies < 0) throw new Error('Total copies cannot be lower than copies currently on loan.');
    const updated = { ...book, ...data, _id: id, totalCopies, availableCopies, updatedAt: new Date().toISOString() };
    this.commitDemo({ books: this.state.books.map(item => item._id === id ? updated : item) }); return updated;
  });
  deleteBook = (id: string) => this.mutate(async connected => {
    if (connected) return this.api.deleteBook(id);
    if (this.state.loans.some(item => item.bookId === id && item.status !== 'returned')) throw new Error('Return active loans before deleting this book.');
    this.commitDemo({ books: this.state.books.filter(item => item._id !== id) });
  });
  addMember = (data: MemberFormData) => this.mutate(async connected => {
    if (connected) return this.api.createMember(data);
    const member: Member = { ...data, id: crypto.randomUUID(), joinedDate: today() };
    this.commitDemo({ members: [member, ...this.state.members], activities: this.activity('add_member', 'Demo patron registered', member.name) }); return member;
  });
  updateMember = (id: string, data: Partial<MemberFormData>) => this.mutate(async connected => {
    if (connected) return this.api.updateMember(id, data);
    const member = this.state.members.find(item => item.id === id); if (!member) throw new Error('Member not found');
    const updated = { ...member, ...data, id }; this.commitDemo({ members: this.state.members.map(item => item.id === id ? updated : item) }); return updated;
  });
  deleteMember = (id: string) => this.mutate(async connected => {
    if (connected) return this.api.deleteMember(id);
    if (this.state.loans.some(item => item.memberId === id && item.status !== 'returned')) throw new Error('Return active loans before deleting this member.');
    this.commitDemo({ members: this.state.members.filter(item => item.id !== id) });
  });
  issueBook = (bookId: string, memberId: string, days = 14, notes?: string) => this.mutate(async connected => {
    if (connected) return this.api.issueBook(bookId, memberId, days, notes);
    const book = this.state.books.find(item => item._id === bookId); const member = this.state.members.find(item => item.id === memberId);
    if (!book || book.availableCopies < 1) throw new Error('No available copy for this book.');
    if (!member || member.status !== 'active') throw new Error('An active patron is required.');
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Loan duration must be 1–90 days.');
    const loan: Loan = { id: crypto.randomUUID(), bookId, bookTitle: book.title, bookAuthor: book.author, memberId, memberName: member.name,
      memberEmail: member.email, borrowDate: today(), dueDate: datePlus(today(), days), status: 'active', notes };
    this.commitDemo({ books: this.state.books.map(item => item._id === bookId ? { ...item, availableCopies: item.availableCopies - 1 } : item),
      loans: [loan, ...this.state.loans], activities: this.activity('borrow', 'Demo checkout', `${book.title} issued to ${member.name}`) }); return loan;
  });
  returnBook = (id: string) => this.mutate(async connected => {
    if (connected) { await this.api.returnBook(id); return; }
    const loan = this.state.loans.find(item => item.id === id); if (!loan) throw new Error('Loan not found');
    if (loan.status === 'returned') return;
    this.commitDemo({ loans: this.state.loans.map(item => item.id === id ? { ...item, status: 'returned', returnDate: today() } : item),
      books: this.state.books.map(item => item._id === loan.bookId ? { ...item, availableCopies: Math.min(item.totalCopies, item.availableCopies + 1) } : item),
      activities: this.activity('return', 'Demo return', loan.bookTitle) });
  });
  renewLoan = (id: string, days = 7) => this.mutate(async connected => {
    if (connected) { await this.api.renewLoan(id, days); return; }
    const loan = this.state.loans.find(item => item.id === id); if (!loan || loan.status === 'returned') throw new Error('Only active loans can be renewed.');
    if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('Renewal duration must be 1–90 days.');
    const dueDate = datePlus(loan.dueDate, days);
    this.commitDemo({ loans: this.state.loans.map(item => item.id === id ? { ...item, dueDate, status: dueDate < today() ? 'overdue' : 'active' } : item) });
  });
  resetDemo = () => {
    this.demo = structuredClone(this.initial); this.enterDemo(); this.storage.setItem(DEMO_KEY, JSON.stringify(this.demo));
  };
}
