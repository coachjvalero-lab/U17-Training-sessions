import React, { useEffect, useState } from 'react';

interface CreateSessionCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    description: string;
    category: string;
    duration: string;
    intensity: string;
    sessionNumber: string;
  }) => Promise<void> | void;
  role?: 'football' | 'fitness' | 'gk';
}

const initialForm = {
  title: '',
  description: '',
  category: 'Tactical',
  duration: '20 min',
  intensity: 'Alta',
  sessionNumber: '1'
};

export const CreateSessionCardModal: React.FC<CreateSessionCardModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  role = 'football'
}) => {
  const [form, setForm] = useState(initialForm);

  const roleCopyByModule: Record<'football' | 'fitness' | 'gk', {
    title: string;
    subtitle: string;
    titleLabel: string;
    titlePlaceholder: string;
    descriptionPlaceholder: string;
    defaultCategory: string;
    defaultDuration: string;
    defaultIntensity: string;
    saveLabel: string;
  }> = {
    football: {
      title: 'New Session Card',
      subtitle: 'Create a reusable football session card in Firestore.',
      titleLabel: 'Title',
      titlePlaceholder: 'e.g. Positional game 4v4',
      descriptionPlaceholder: 'Describe the purpose and details of the session card',
      defaultCategory: 'Tactical',
      defaultDuration: '20 min',
      defaultIntensity: 'Alta',
      saveLabel: 'Save card'
    },
    fitness: {
      title: 'New Fitness Card',
      subtitle: 'Create a reusable fitness and conditioning card in Firestore.',
      titleLabel: 'Block title',
      titlePlaceholder: 'e.g. Acceleration circuit',
      descriptionPlaceholder: 'Describe the physical objective, load, and coaching cues for this block.',
      defaultCategory: 'Conditioning',
      defaultDuration: '25 min',
      defaultIntensity: 'Moderate-High',
      saveLabel: 'Save fitness card'
    },
    gk: {
      title: 'New GK Card',
      subtitle: 'Create a reusable goalkeeper-specific card in Firestore.',
      titleLabel: 'Drill title',
      titlePlaceholder: 'e.g. 1v1 reaction series',
      descriptionPlaceholder: 'Describe the technical focus, distribution goal, and coaching points for this drill.',
      defaultCategory: 'GK',
      defaultDuration: '18 min',
      defaultIntensity: 'High',
      saveLabel: 'Save GK card'
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setForm(initialForm);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const roleCopy = roleCopyByModule[role];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category.trim() || roleCopy.defaultCategory,
      duration: form.duration.trim() || roleCopy.defaultDuration,
      intensity: form.intensity.trim() || roleCopy.defaultIntensity,
      sessionNumber: form.sessionNumber.trim()
    };

    if (!payload.title) return;

    await onSubmit(payload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 py-8">
      <div className="w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900/95 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-white">{roleCopy.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{roleCopy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-300">
              <span className="mb-1 block">Session number</span>
              <input
                type="number"
                min="1"
                value={form.sessionNumber}
                onChange={(e) => setForm({ ...form, sessionNumber: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-300">
              <span className="mb-1 block">Category</span>
              <input
                type="text"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-300">
            <span className="mb-1 block">{roleCopy.titleLabel}</span>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              placeholder={roleCopy.titlePlaceholder}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-300">
            <span className="mb-1 block">Description</span>
            <textarea
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              placeholder={roleCopy.descriptionPlaceholder}
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-300">
              <span className="mb-1 block">Duration</span>
              <input
                type="text"
                value={form.duration}
                onChange={(e) => setForm({ ...form, duration: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-300">
              <span className="mb-1 block">Intensity</span>
              <input
                type="text"
                value={form.intensity}
                onChange={(e) => setForm({ ...form, intensity: e.target.value })}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-white outline-none ring-0"
              />
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-black text-white transition hover:bg-emerald-500"
            >
              {roleCopy.saveLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
