import React, { useState, useMemo } from 'react';
import { TrainingSession, Exercise, GameMoment } from '../types';
import { CloudTrainingSession } from '../firebase';
import { 
  BarChart3, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  Target, 
  Activity, 
  ShieldCheck, 
  Flame, 
  Shield, 
  Zap, 
  CornerDownRight, 
  Sliders, 
  BookOpen, 
  CheckCircle2, 
  Dumbbell, 
  TrendingUp,
  Info
} from 'lucide-react';

interface PlanificationSectionProps {
  session: TrainingSession;
  cloudSessions: CloudTrainingSession[];
}

// Helper to parse duration string into numeric minutes
export function parseDurationMinutes(durationStr?: string): number {
  if (!durationStr || typeof durationStr !== 'string') return 10; // default 10 min fallback if missing
  const str = durationStr.trim().toLowerCase();
  if (!str) return 10;

  // Pattern 1: "3 x 5" or "3x5" -> 15
  const multMatch = str.match(/(\d+)\s*x\s*(\d+)/);
  if (multMatch) {
    const sets = parseInt(multMatch[1], 10);
    const minsPerSet = parseInt(multMatch[2], 10);
    if (!isNaN(sets) && !isNaN(minsPerSet)) {
      return sets * minsPerSet;
    }
  }

  // Pattern 2: "10 + 5" -> 15
  const addMatch = str.match(/(\d+)\s*\+\s*(\d+)/);
  if (addMatch) {
    const a = parseInt(addMatch[1], 10);
    const b = parseInt(addMatch[2], 10);
    if (!isNaN(a) && !isNaN(b)) {
      return a + b;
    }
  }

  // Pattern 3: Standard single number "15 min", "20'", "12"
  const numMatch = str.match(/(\d+)/);
  if (numMatch) {
    const val = parseInt(numMatch[1], 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return 10;
}

export interface SubMomentStat {
  subMomentName: string;
  totalMinutes: number;
  sessionIds: Set<string>;
  sessionNumbers: Set<string>;
  exerciseCount: number;
  exercises: {
    sessionId: string;
    sessionNumber: string;
    sessionObjective: string;
    exerciseName: string;
    duration: number;
    category: string;
  }[];
}

export interface GameMomentStat {
  momentId: string;
  label: string;
  shortLabel: string;
  totalMinutes: number;
  sessionIds: Set<string>;
  exerciseCount: number;
  subMoments: Map<string, SubMomentStat>;
  color: {
    bg: string;
    border: string;
    text: string;
    accentBg: string;
    badgeBg: string;
    barColor: string;
    lightBg: string;
    hex: string;
  };
  icon: React.ComponentType<{ className?: string }>;
}

const MOMENT_CONFIGS: Record<string, {
  label: string;
  shortLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: GameMomentStat['color'];
}> = {
  'Attack': {
    label: 'Attack / Offensive Phase',
    shortLabel: 'Attack',
    icon: Flame,
    color: {
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/30',
      text: 'text-amber-700',
      accentBg: 'bg-amber-500',
      badgeBg: 'bg-amber-100 text-amber-800 border-amber-300',
      barColor: 'bg-amber-500',
      lightBg: 'bg-amber-50/70',
      hex: '#f59e0b'
    }
  },
  'Defense': {
    label: 'Defense / Defensive Phase',
    shortLabel: 'Defense',
    icon: Shield,
    color: {
      bg: 'bg-indigo-500/10',
      border: 'border-indigo-500/30',
      text: 'text-indigo-700',
      accentBg: 'bg-indigo-600',
      badgeBg: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      barColor: 'bg-indigo-600',
      lightBg: 'bg-indigo-50/70',
      hex: '#4f46e5'
    }
  },
  'Transition A-D': {
    label: 'Transition A-D (Attack to Defense / Counter-press)',
    shortLabel: 'Transition A-D',
    icon: Zap,
    color: {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/30',
      text: 'text-emerald-700',
      accentBg: 'bg-emerald-600',
      badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      barColor: 'bg-emerald-600',
      lightBg: 'bg-emerald-50/70',
      hex: '#10b981'
    }
  },
  'Transition D-A': {
    label: 'Transition D-A (Defense to Attack / Counter-attack)',
    shortLabel: 'Transition D-A',
    icon: TrendingUp,
    color: {
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/30',
      text: 'text-teal-700',
      accentBg: 'bg-teal-600',
      badgeBg: 'bg-teal-100 text-teal-800 border-teal-300',
      barColor: 'bg-teal-600',
      lightBg: 'bg-teal-50/70',
      hex: '#0d9488'
    }
  },
  'Set Pieces': {
    label: 'Set Pieces (Corners, Free Kicks, Throw-ins)',
    shortLabel: 'Set Pieces',
    icon: Target,
    color: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/30',
      text: 'text-purple-700',
      accentBg: 'bg-purple-600',
      badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
      barColor: 'bg-purple-600',
      lightBg: 'bg-purple-50/70',
      hex: '#9333ea'
    }
  },
  'Other': {
    label: 'General / Warm Up / Other',
    shortLabel: 'Other',
    icon: Layers,
    color: {
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/30',
      text: 'text-slate-700',
      accentBg: 'bg-slate-600',
      badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
      barColor: 'bg-slate-600',
      lightBg: 'bg-slate-50/70',
      hex: '#64748b'
    }
  }
};

export const PlanificationSection: React.FC<PlanificationSectionProps> = ({
  session,
  cloudSessions
}) => {
  const [scopeFilter, setScopeFilter] = useState<'all' | 'active'>('all');
  const [expandedMoments, setExpandedMoments] = useState<Record<string, boolean>>({
    'Attack': true,
    'Defense': true,
    'Transition A-D': false,
    'Transition D-A': false,
    'Set Pieces': false,
    'Other': false
  });

  // Combine sessions based on selected filter scope
  const allSessionsToAnalyze = useMemo(() => {
    if (scopeFilter === 'active') {
      return [session];
    }

    // Merge cloud sessions and active session without duplicates (by session ID or sessionNumber)
    const map = new Map<string, TrainingSession>();
    
    cloudSessions.forEach(cs => {
      map.set(cs.id || `sess-${cs.sessionNumber}`, cs);
    });

    // Ensure active session is present
    map.set(session.id || `sess-${session.sessionNumber}`, session);

    return Array.from(map.values());
  }, [session, cloudSessions, scopeFilter]);

  // Aggregate stats across sessions
  const aggregatedStats = useMemo(() => {
    // Initialize stats structure for all moment categories
    const statsMap = new Map<string, GameMomentStat>();

    Object.keys(MOMENT_CONFIGS).forEach(momentKey => {
      const cfg = MOMENT_CONFIGS[momentKey];
      statsMap.set(momentKey, {
        momentId: momentKey,
        label: cfg.label,
        shortLabel: cfg.shortLabel,
        totalMinutes: 0,
        sessionIds: new Set<string>(),
        exerciseCount: 0,
        subMoments: new Map<string, SubMomentStat>(),
        color: cfg.color,
        icon: cfg.icon
      });
    });

    let totalTrainingMinutesAll = 0;
    let totalExercisesAll = 0;

    allSessionsToAnalyze.forEach(sess => {
      const sessId = sess.id || `session-${sess.sessionNumber || '1'}`;
      const sessNum = sess.sessionNumber ? `#${sess.sessionNumber}` : '#1';
      const sessObjective = sess.mainObjective || 'General Training Session';

      // Collect exercises exclusively from the Football tab (Warm Up, Main Part, Cool Down)
      const blocksWithCategory: { block: Exercise[]; category: string }[] = [
        { block: sess.warmUp?.exercises || [], category: 'football' },
        { block: sess.mainPart?.exercises || [], category: 'football' },
        { block: sess.coolDown?.exercises || [], category: 'football' }
      ];

      blocksWithCategory.forEach(({ block, category }) => {
        block.forEach(ex => {
          if (!ex || !ex.name) return;

          // Determine game moment key from exercise
          let momentKey: string = ex.gameMoment || 'Other';

          if (!statsMap.has(momentKey)) {
            momentKey = 'Other';
          }

          const durationMins = parseDurationMinutes(ex.duration);
          const subMomentName = (ex.subMoment && ex.subMoment.trim()) ? ex.subMoment.trim() : 'General / Tactical Drills';

          const mStat = statsMap.get(momentKey)!;
          mStat.totalMinutes += durationMins;
          mStat.exerciseCount += 1;
          mStat.sessionIds.add(sessId);

          totalTrainingMinutesAll += durationMins;
          totalExercisesAll += 1;

          // Aggregate inside sub-moments map
          if (!mStat.subMoments.has(subMomentName)) {
            mStat.subMoments.set(subMomentName, {
              subMomentName,
              totalMinutes: 0,
              sessionIds: new Set<string>(),
              sessionNumbers: new Set<string>(),
              exerciseCount: 0,
              exercises: []
            });
          }

          const subStat = mStat.subMoments.get(subMomentName)!;
          subStat.totalMinutes += durationMins;
          subStat.exerciseCount += 1;
          subStat.sessionIds.add(sessId);
          subStat.sessionNumbers.add(sessNum);
          subStat.exercises.push({
            sessionId: sessId,
            sessionNumber: sessNum,
            sessionObjective: sessObjective,
            exerciseName: ex.name,
            duration: durationMins,
            category
          });
        });
      });
    });

    // Convert map to sorted array (sorted by total minutes descending)
    const momentsList = Array.from(statsMap.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);

    return {
      momentsList,
      totalTrainingMinutesAll,
      totalExercisesAll,
      totalSessionsCount: allSessionsToAnalyze.length
    };
  }, [allSessionsToAnalyze]);

  const toggleExpand = (momentKey: string) => {
    setExpandedMoments(prev => ({
      ...prev,
      [momentKey]: !prev[momentKey]
    }));
  };

  const expandAll = () => {
    const next: Record<string, boolean> = {};
    aggregatedStats.momentsList.forEach(m => { next[m.momentId] = true; });
    setExpandedMoments(next);
  };

  const collapseAll = () => {
    const next: Record<string, boolean> = {};
    aggregatedStats.momentsList.forEach(m => { next[m.momentId] = false; });
    setExpandedMoments(next);
  };

  return (
    <div className="space-y-6 pb-12 print:block">
      
      {/* Header Banner */}
      <div className="bg-[#002142] text-white rounded-3xl p-6 md:p-8 shadow-xl border border-[#0f5981]/40 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-[#0f5981]/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 bg-[#0f5981]/40 border border-[#a79078]/40 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider text-[#a79078]">
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
              <span>Macrocycle Planning & Periodization</span>
            </div>
            
            <h1 className="text-2xl md:text-3xl font-display font-black tracking-tight text-white uppercase">
              Planification & Volume Analytics
            </h1>
            
            <p className="text-xs text-sky-200/80 max-w-2xl font-medium leading-relaxed">
              Automatic time and training session accumulation broken down by game moments and sub-moments across your sessions.
            </p>
          </div>

          {/* Scope Selector Control */}
          <div className="flex items-center bg-slate-900/80 p-1.5 rounded-2xl border border-slate-700/60 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setScopeFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                scopeFilter === 'all'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Sessions ({cloudSessions.length + (cloudSessions.some(c => c.id === session.id) ? 0 : 1)})</span>
            </button>

            <button
              type="button"
              onClick={() => setScopeFilter('active')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                scopeFilter === 'active'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Current Session Only</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Training Time */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Volume</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-display font-black text-slate-900">
              {aggregatedStats.totalTrainingMinutesAll} <span className="text-xs font-bold text-slate-500">mins</span>
            </div>
            <div className="text-[10px] font-bold text-amber-700 mt-0.5">
              ~{(aggregatedStats.totalTrainingMinutesAll / 60).toFixed(1)} Hours
            </div>
          </div>
        </div>

        {/* Sessions Analyzed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Sessions Analyzed</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-display font-black text-slate-900">
              {aggregatedStats.totalSessionsCount} <span className="text-xs font-bold text-slate-500">sessions</span>
            </div>
            <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
              Microcycle database
            </div>
          </div>
        </div>

        {/* Total Drills & Exercises */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Exercises Executed</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-display font-black text-slate-900">
              {aggregatedStats.totalExercisesAll} <span className="text-xs font-bold text-slate-500">drills</span>
            </div>
            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
              Across all categories
            </div>
          </div>
        </div>

        {/* Dominant Game Moment */}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm space-y-2">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider">Top Moment Focus</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <Target className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-base font-display font-black text-slate-900 truncate">
              {aggregatedStats.momentsList[0]?.shortLabel || 'N/A'}
            </div>
            <div className="text-[10px] font-bold text-purple-700 mt-0.5">
              {aggregatedStats.totalTrainingMinutesAll > 0 
                ? `${Math.round((aggregatedStats.momentsList[0]?.totalMinutes / aggregatedStats.totalTrainingMinutesAll) * 100)}% of total training time`
                : '0%'}
            </div>
          </div>
        </div>
      </div>

      {/* Global Proportional Visual Stack Bar */}
      {aggregatedStats.totalTrainingMinutesAll > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-display font-black uppercase tracking-wider text-slate-800 flex items-center space-x-2">
              <Sliders className="w-4 h-4 text-emerald-600" />
              <span>Volume Share Distribution by Game Moment</span>
            </h3>
            <span className="text-[11px] font-extrabold text-slate-400">
              100% Total Volume
            </span>
          </div>

          {/* Stacked Percentage Bar */}
          <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            {aggregatedStats.momentsList.map(m => {
              if (m.totalMinutes <= 0) return null;
              const pct = (m.totalMinutes / aggregatedStats.totalTrainingMinutesAll) * 100;
              return (
                <div
                  key={m.momentId}
                  style={{ width: `${pct}%`, backgroundColor: m.color.hex }}
                  className="h-full transition-all duration-500 hover:opacity-85 relative group"
                  title={`${m.label}: ${m.totalMinutes} min (${pct.toFixed(1)}%)`}
                />
              );
            })}
          </div>

          {/* Color Legend Badges */}
          <div className="flex flex-wrap gap-2 pt-1">
            {aggregatedStats.momentsList.map(m => {
              if (m.totalMinutes <= 0) return null;
              const pct = Math.round((m.totalMinutes / aggregatedStats.totalTrainingMinutesAll) * 100);
              return (
                <div key={m.momentId} className={`text-[10px] font-extrabold px-2.5 py-1 rounded-xl border flex items-center space-x-1.5 ${m.color.badgeBg}`}>
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: m.color.hex }} />
                  <span>{m.shortLabel}:</span>
                  <strong className="font-black">{m.totalMinutes}m ({pct}%)</strong>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accordions Control Bar */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-base font-display font-black uppercase tracking-tight text-slate-900 flex items-center space-x-2">
          <BarChart3 className="w-5 h-5 text-[#002142]" />
          <span>Game Moments & Sub-moments Detail</span>
        </h2>

        <div className="flex items-center space-x-2 text-xs font-bold">
          <button
            type="button"
            onClick={expandAll}
            className="text-emerald-700 hover:bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl transition-all"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="text-slate-600 hover:bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-xl transition-all"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Moments Collapsible List */}
      <div className="space-y-4">
        {aggregatedStats.momentsList.map(moment => {
          const IconComponent = moment.icon;
          const isExpanded = !!expandedMoments[moment.momentId];
          const pct = aggregatedStats.totalTrainingMinutesAll > 0 
            ? Math.round((moment.totalMinutes / aggregatedStats.totalTrainingMinutesAll) * 100) 
            : 0;

          const subMomentsArray = (Array.from(moment.subMoments.values()) as SubMomentStat[]).sort((a, b) => b.totalMinutes - a.totalMinutes);

          return (
            <div 
              key={moment.momentId}
              className={`bg-white border rounded-2xl shadow-sm transition-all overflow-hidden ${
                moment.totalMinutes > 0 ? moment.color.border : 'border-slate-200 opacity-75'
              }`}
            >
              {/* Moment Accordion Header */}
              <div 
                onClick={() => toggleExpand(moment.momentId)}
                className={`p-4 md:p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer select-none transition-colors ${
                  isExpanded ? moment.color.lightBg : 'hover:bg-slate-50'
                }`}
              >
                {/* Left side: Icon, Title, and Badges */}
                <div className="flex items-center space-x-3.5 min-w-[240px]">
                  <div className={`p-3 rounded-2xl text-white shadow-sm shrink-0 ${moment.color.accentBg}`}>
                    <IconComponent className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-base font-display font-black text-slate-900 uppercase">
                        {moment.shortLabel}
                      </h3>
                      <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md border ${moment.color.badgeBg}`}>
                        {pct}% Share
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">
                      {moment.label}
                    </p>
                  </div>
                </div>

                {/* Right side: Minutes Counter, Sessions Count & Chevron */}
                <div className="flex items-center space-x-4 ml-auto">
                  {/* Accumulated Minutes Badge */}
                  <div className="text-right">
                    <div className="text-base font-display font-black text-slate-900 flex items-center justify-end space-x-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{moment.totalMinutes} min</span>
                    </div>
                    <div className="text-[10px] font-bold text-slate-500">
                      {moment.exerciseCount} drill{moment.exerciseCount !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Sessions Count Badge */}
                  <div className="text-right pl-3 border-l border-slate-200">
                    <div className="text-xs font-black text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-xl flex items-center space-x-1">
                      <Calendar className="w-3 h-3 text-emerald-600" />
                      <span>{moment.sessionIds.size} Training{moment.sessionIds.size !== 1 ? 's' : ''}</span>
                    </div>
                  </div>

                  {/* Accordion Toggle Icon */}
                  <div className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Collapsible Content: Sub-moments Breakdown */}
              {isExpanded && (
                <div className="p-4 md:p-6 border-t border-slate-100 bg-white space-y-4">
                  
                  {subMomentsArray.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-400 italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      No exercises recorded for this game moment in selected sessions.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 pb-1 border-b border-slate-100">
                        <span>Sub-moment / Tactical Principle</span>
                        <div className="flex items-center space-x-8">
                          <span>Sessions Worked</span>
                          <span>Accumulated Volume</span>
                        </div>
                      </div>

                      {subMomentsArray.map((sub, idx) => {
                        const subPct = moment.totalMinutes > 0 ? Math.round((sub.totalMinutes / moment.totalMinutes) * 100) : 0;
                        const sessionNumbersList = Array.from(sub.sessionNumbers);

                        return (
                          <div 
                            key={sub.subMomentName + idx}
                            className="bg-slate-50/70 hover:bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-3 transition-colors"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              
                              {/* Sub-moment Title */}
                              <div className="flex items-start space-x-2.5 min-w-[200px]">
                                <CornerDownRight className={`w-4 h-4 mt-0.5 shrink-0 ${moment.color.text}`} />
                                <div>
                                  <h4 className="text-xs font-extrabold text-slate-900">
                                    {sub.subMomentName}
                                  </h4>
                                  <p className="text-[10px] text-slate-500 font-semibold">
                                    {sub.exerciseCount} exercise{sub.exerciseCount !== 1 ? 's' : ''} in category
                                  </p>
                                </div>
                              </div>

                              {/* Stats Indicators */}
                              <div className="flex items-center space-x-6 ml-auto">
                                
                                {/* Sessions Count Badge */}
                                <div className="text-center">
                                  <span className="inline-flex items-center space-x-1 text-xs font-black bg-white border border-slate-200 px-2.5 py-1 rounded-xl text-slate-800 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>{sub.sessionIds.size} Training{sub.sessionIds.size !== 1 ? 's' : ''}</span>
                                  </span>
                                </div>

                                {/* Total Minutes Badge */}
                                <div className="text-right min-w-[90px]">
                                  <div className="text-xs font-black text-slate-900">
                                    {sub.totalMinutes} min
                                  </div>
                                  <div className="text-[9px] font-bold text-slate-400">
                                    {subPct}% of category
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Relative Progress Bar within Category */}
                            <div className="w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${subPct}%`, backgroundColor: moment.color.hex }} 
                                className="h-full rounded-full transition-all duration-300"
                              />
                            </div>

                            {/* Sessions & Drills Tags */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1">
                              <span className="text-[9px] font-black uppercase text-slate-400 mr-1">
                                Trained in:
                              </span>
                              {sub.exercises.map((exItem, exIdx) => (
                                <span 
                                  key={exIdx}
                                  className="text-[10px] font-bold bg-white text-slate-700 border border-slate-200 px-2 py-0.5 rounded-lg shadow-2xs flex items-center space-x-1"
                                >
                                  <span className="text-emerald-700 font-extrabold">{exItem.sessionNumber}</span>
                                  <span className="text-slate-300">•</span>
                                  <span className="truncate max-w-[150px]">{exItem.exerciseName}</span>
                                  <span className="text-[#a79078] font-bold">({exItem.duration}m)</span>
                                </span>
                              ))}
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  )}

                </div>
              )}

            </div>
          );
        })}
      </div>

    </div>
  );
};
