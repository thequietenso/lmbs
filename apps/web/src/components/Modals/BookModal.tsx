/* oxlint-disable react/set-state-in-effect -- Reset mounted modal state at open/identity boundaries, not on ordinary renders. */
import React, { useState, useEffect } from 'react';
import { Book, BookFormData } from '../../types';
import { X, BookOpen } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import { editableBookValues } from '../../services/bookForm';

interface BookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: BookFormData) => Promise<void>;
  initialBook?: Book | null;
}

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
  'linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%)',
  'linear-gradient(135deg, #10b981 0%, #059669 100%)',
  'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
  'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
  'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
  'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
];

export const BookModal: React.FC<BookModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialBook,
}) => {
  const { genres } = useLibrary();
  const [formData, setFormData] = useState<BookFormData>(() => ({
    title: '',
    author: '',
    genre: 'Computer Science',
    pages: 350,
    publishedYear: new Date().getFullYear(),
    isbn: '',
    totalCopies: 3,
    shelfLocation: 'Tech Wing - A1',
    description: '',
    coverGradient: GRADIENT_PRESETS[0],
  }));

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const close = () => { if (!saving) onClose(); };

  useEffect(() => {
    if (initialBook) {
      setFormData(editableBookValues(initialBook));
    } else {
      setFormData({
        title: '',
        author: '',
        genre: 'Computer Science',
        pages: 350,
        publishedYear: new Date().getFullYear(),
        isbn: `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`,
        totalCopies: 3,
        shelfLocation: 'Tech Wing - A1',
        description: '',
        coverGradient: GRADIENT_PRESETS[Math.floor(Math.random() * GRADIENT_PRESETS.length)],
      });
    }
    setErrors({});
  }, [initialBook, isOpen]);

  if (!isOpen) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required';
    if (!formData.author.trim()) newErrors.author = 'Author is required';
    if (!formData.genre.trim()) newErrors.genre = 'Genre is required';
    if (!Number.isInteger(formData.totalCopies) || formData.totalCopies < 0) newErrors.totalCopies = 'Total copies must be a non-negative whole number';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || !validate()) return;
    setSaving(true);
    try { await onSubmit(formData); onClose(); }
    catch (error) { setErrors(previous => ({ ...previous, submit: error instanceof Error ? error.message : 'Save failed' })); }
    finally { setSaving(false); }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      id="book-modal-backdrop"
      onClick={close}
    >
      <div
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        id="book-modal-dialog"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center">
              <BookOpen size={17} />
            </div>
            <h2 className="font-bold text-lg text-slate-900 dark:text-white">
              {initialBook ? 'Edit Book Details' : 'Catalog New Book'}
            </h2>
          </div>
          <button
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            onClick={close}
            aria-label="Close modal"
            id="close-book-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" aria-busy={saving}>
          {errors.submit && <p role="alert" className="px-5 pt-3 text-sm text-rose-500">{errors.submit}</p>}
          <fieldset disabled={saving} className="contents">
          <div className="p-5 overflow-y-auto space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-title-input">
                Book Title *
              </label>
              <input
                id="book-title-input"
                type="text"
                className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="e.g. Designing Data-Intensive Applications"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              {errors.title && <p className="text-xs text-rose-500 font-medium">{errors.title}</p>}
            </div>

            {/* Author */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-author-input">
                Author(s) *
              </label>
              <input
                id="book-author-input"
                type="text"
                className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                placeholder="e.g. Martin Kleppmann"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              />
              {errors.author && <p className="text-xs text-rose-500 font-medium">{errors.author}</p>}
            </div>

            {/* Genre & Published Year */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-genre-select">
                  Category *
                </label>
                <select
                  id="book-genre-select"
                  className="w-full h-10 px-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={formData.genre}
                  onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                >
                  {Array.from(new Set([formData.genre, ...genres.map(genre => genre.name), 'Computer Science', 'Software Engineering', 'Science Fiction', 'Design & UX', 'History', 'Self Improvement', 'Productivity', 'Philosophy', 'Mathematics', 'Literature'])).filter(Boolean).map(genre => <option key={genre} value={genre}>{genre}</option>)}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-year-input">
                  Publication Year
                </label>
                <input
                  id="book-year-input"
                  type="number"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="2024"
                  value={formData.publishedYear ?? ''}
                  onChange={(e) => setFormData({ ...formData, publishedYear: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Pages & Copies */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-pages-input">
                  Page Count
                </label>
                <input
                  id="book-pages-input"
                  type="number"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="e.g. 450"
                  value={formData.pages ?? ''}
                  onChange={(e) => setFormData({ ...formData, pages: Number(e.target.value) })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-copies-input">
                  Inventory Copies *
                </label>
                <input
                  id="book-copies-input"
                  type="number"
                  min="0"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  value={formData.totalCopies}
                  onChange={(e) => setFormData({ ...formData, totalCopies: Number(e.target.value) })}
                />
                {errors.totalCopies && <p className="text-xs text-rose-500 font-medium">{errors.totalCopies}</p>}
              </div>
            </div>

            {/* ISBN & Shelf Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-isbn-input">
                  ISBN-13
                </label>
                <input
                  id="book-isbn-input"
                  type="text"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 font-mono"
                  placeholder="978-0132350884"
                  value={formData.isbn || ''}
                  onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-shelf-input">
                  Shelf / Stacks Locator
                </label>
                <input
                  id="book-shelf-input"
                  type="text"
                  className="w-full h-10 px-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Tech Wing - B2"
                  value={formData.shelfLocation || ''}
                  onChange={(e) => setFormData({ ...formData, shelfLocation: e.target.value })}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="book-desc-input">
                Synopsis
              </label>
              <textarea
                id="book-desc-input"
                className="w-full p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 leading-relaxed"
                rows={3}
                placeholder="Brief summary of book themes and contents..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            {/* Gradient Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Book Spine Gradient
              </label>
              <div className="flex gap-2 flex-wrap">
                {GRADIENT_PRESETS.map((grad, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setFormData({ ...formData, coverGradient: grad })}
                    className={`w-7 h-7 rounded-lg transition-transform cursor-pointer ${
                      formData.coverGradient === grad ? 'scale-110 ring-2 ring-indigo-500 ring-offset-2 dark:ring-offset-slate-900' : 'hover:scale-105'
                    }`}
                    style={{ background: grad }}
                    aria-label={`Select gradient ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm cursor-pointer"
              onClick={close}
              id="cancel-book-modal-btn"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all shadow-md shadow-indigo-500/25 cursor-pointer"
              id="submit-book-form-btn"
            >
              {saving ? 'Saving…' : initialBook ? 'Save Changes' : 'Catalog Book'}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
