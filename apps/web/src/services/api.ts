import type { Book, BookFormData, Member, MemberFormData, Loan, ActivityItem, AuthSession, UserIdentity, Genre, Review } from '../types';

const DEFAULT_API_BASE = import.meta.env?.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const SESSION_KEY = 'lmbs_session';
import type { PaginatedResponse, BookStats, LoanStats } from '@lmbs/shared';
type Page<T> = PaginatedResponse<T>;

export class LibraryApiService {
  private baseUrl: string;
  private session: AuthSession | null = null;
  private revision = 0;
  private expired: (() => void) | undefined;

  constructor(customUrl?: string) {
    if (customUrl) this.baseUrl = this.validateUrl(customUrl);
    else {
      try { this.baseUrl = this.validateUrl(localStorage.getItem('lmbs_api_url') || DEFAULT_API_BASE); }
      catch {
        localStorage.removeItem('lmbs_api_url'); sessionStorage.removeItem(SESSION_KEY);
        this.baseUrl = this.validateUrl(DEFAULT_API_BASE);
      }
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      if (saved?.baseUrl === this.baseUrl && typeof saved.access_token === 'string' && saved.user?.id) {
        this.session = { access_token: saved.access_token, user: saved.user };
      } else if (saved) sessionStorage.removeItem(SESSION_KEY);
    } catch { sessionStorage.removeItem(SESSION_KEY); }
  }

  private validateUrl(value: string) {
    const trimmed = value.trim();
    if (trimmed.startsWith('//')) throw new Error('Use a same-origin path or an explicit HTTP(S) URL.');
    const relative = trimmed.startsWith('/');
    const url = new URL(trimmed, relative ? globalThis.location?.origin : undefined);
    if (relative && url.origin !== globalThis.location?.origin) throw new Error('Relative API paths must stay on the current origin.');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
      throw new Error('Use an HTTP(S) API base URL without credentials, query, or fragment.');
    }
    return url.href.replace(/\/+$/, '');
  }
  getBaseUrl() { return this.baseUrl; }
  getRevision() { return this.revision; }
  getSession() { return this.session; }
  onSessionExpired(handler: (() => void) | undefined) { this.expired = handler; }
  setSession(session: AuthSession) {
    this.revision++;
    this.session = session;
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, baseUrl: this.baseUrl }));
  }
  clearSession() {
    this.revision++;
    this.session = null;
    sessionStorage.removeItem(SESSION_KEY);
  }
  setBaseUrl(value: string) {
    const url = this.validateUrl(value);
    if (url !== this.baseUrl) this.clearSession();
    this.baseUrl = url;
    localStorage.setItem('lmbs_api_url', url);
  }

  private async request<T>(path: string, method = 'GET', body?: unknown, authenticated = true): Promise<T> {
    const revision = this.revision;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (authenticated && this.session) headers.Authorization = `Bearer ${this.session.access_token}`;
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
        credentials: 'omit', redirect: 'error',
      });
      const text = await response.text();
      if (revision !== this.revision) throw new Error('Session or server changed. Please retry.');
      if (response.status === 401 && authenticated && this.session) {
        this.clearSession(); this.expired?.();
      }
      let result: unknown;
      try { result = text ? JSON.parse(text) : undefined; } catch { throw new Error(`Invalid API response (HTTP ${response.status})`); }
      if (!response.ok) {
        const message = (result as { message?: string | string[] })?.message;

        throw new Error(Array.isArray(message) ? message.join('; ') : message || `HTTP ${response.status}: ${response.statusText}`);
      }
      return result as T;
    } finally { clearTimeout(timeout); }
  }

  private async all<T>(path: string): Promise<T[]> {
    const data: T[] = [];
    const revision = this.revision;
    for (let page = 1; ; page++) {
      if (revision !== this.revision) throw new Error('Session or server changed. Please retry.');
      const result = await this.request<Page<T>>(`${path}${path.includes('?') ? '&' : '?'}page=${page}&limit=100`);
      if (!Array.isArray(result?.data) || result.page !== page || !Number.isInteger(result.total) || result.total < 0 || !Number.isInteger(result.limit) || result.limit < 1) {
        throw new Error('Invalid paginated API response.');
      }
      data.push(...result.data);
      if (page * result.limit >= result.total) return data;
      if (!result.data.length) throw new Error('Incomplete paginated API response. Please sync again.');
    }
  }

  async checkConnection(): Promise<{ connected: boolean; latencyMs?: number; error?: string }> {
    const start = performance.now();
    try {
      await this.request('/health', 'GET', undefined, false);
      return { connected: true, latencyMs: Math.round(performance.now() - start) };
    } catch (error) { return { connected: false, error: error instanceof Error ? error.message : 'Connection failed' }; }
  }
  login(data: { email: string; password: string }) {
    return this.request<AuthSession>('/auth/login', 'POST', { email: data.email, password: data.password }, false);
  }
  register(data: { email: string; password: string; name: string }) {
    return this.request<AuthSession>('/auth/register', 'POST', { email: data.email, password: data.password, name: data.name }, false);
  }
  me() { return this.request<UserIdentity>('/auth/me'); }
  getBooks() { return this.all<Book>('/books'); }
  getMembers() { return this.all<Member>('/members'); }
  getLoans() { return this.all<Loan>('/loans'); }
  getActivities() { return this.all<ActivityItem>('/activities'); }
  getGenres() { return this.all<Genre>('/genres'); }
  getReviews(bookId?: string) { return this.all<Review>(`/reviews${bookId ? `?bookId=${encodeURIComponent(bookId)}` : ''}`); }
  getBookStats() { return this.request<BookStats>('/stats/books'); }
  getLoanStats() { return this.request<LoanStats>('/stats/loans'); }

  private bookPayload(data: Partial<BookFormData>) {
    const { title, author, genre, pages, publishedYear, isbn, totalCopies, shelfLocation, description, coverGradient } = data;
    return { title, author, genre, pages, publishedYear, isbn: isbn?.trim() || undefined, totalCopies, shelfLocation, description, coverGradient };
  }
  createBook(data: BookFormData) { return this.request<Book>('/books', 'POST', this.bookPayload(data)); }
  updateBook(id: string, data: Partial<BookFormData>) { return this.request<Book>(`/books/${encodeURIComponent(id)}`, 'PUT', { ...this.bookPayload(data), updatedAt: data.updatedAt }); }
  deleteBook(id: string) { return this.request<void>(`/books/${encodeURIComponent(id)}`, 'DELETE'); }
  private memberPayload(data: Partial<MemberFormData>) {
    const { name, email, phone, membershipNumber, status, bio, hobbies } = data;
    return { name, email, phone, membershipNumber, status, bio, hobbies };
  }
  createMember(data: MemberFormData) { return this.request<Member>('/members', 'POST', this.memberPayload(data)); }
  updateMember(id: string, data: Partial<MemberFormData>) { return this.request<Member>(`/members/${encodeURIComponent(id)}`, 'PUT', this.memberPayload(data)); }
  deleteMember(id: string) { return this.request<void>(`/members/${encodeURIComponent(id)}`, 'DELETE'); }
  issueBook(bookId: string, memberId: string, days = 14, notes?: string) { return this.request<Loan>('/loans', 'POST', { bookId, memberId, days, notes }); }
  returnBook(id: string) { return this.request<Loan>(`/loans/${encodeURIComponent(id)}/return`, 'PUT', {}); }
  renewLoan(id: string, days = 7) { return this.request<Loan>(`/loans/${encodeURIComponent(id)}/renew`, 'PUT', { days }); }
}

export const apiService = new LibraryApiService();
