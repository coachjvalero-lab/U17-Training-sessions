import { TrainingSession } from './types';

// Simple default soccer field diagram (encoded as standard base64 or inline SVG to serve as placeholder)
const DEFAULT_TACTICAL_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" fill="%2315803d" />
  <rect x="10" y="10" width="380" height="280" fill="none" stroke="white" stroke-width="2" />
  <line x1="200" y1="10" x2="200" y2="290" stroke="white" stroke-width="2" />
  <circle cx="200" cy="150" r="40" fill="none" stroke="white" stroke-width="2" />
  <circle cx="200" cy="150" r="3" fill="white" />
  
  <!-- Areas -->
  <rect x="10" y="70" width="50" height="160" fill="none" stroke="white" stroke-width="2" />
  <rect x="10" y="110" width="15" height="80" fill="none" stroke="white" stroke-width="2" />
  
  <rect x="340" y="70" width="50" height="160" fill="none" stroke="white" stroke-width="2" />
  <rect x="375" y="110" width="15" height="80" fill="none" stroke="white" stroke-width="2" />
  
  <!-- Corners -->
  <path d="M 10 20 A 10 10 0 0 0 20 10" fill="none" stroke="white" stroke-width="2" />
  <path d="M 380 10 A 10 10 0 0 0 390 20" fill="none" stroke="white" stroke-width="2" />
  <path d="M 20 290 A 10 10 0 0 0 10 280" fill="none" stroke="white" stroke-width="2" />
  <path d="M 390 280 A 10 10 0 0 0 380 290" fill="none" stroke="white" stroke-width="2" />
</svg>`;

const DEFAULT_RONDO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" fill="%23166534" />
  <!-- Grid -->
  <rect x="100" y="50" width="200" height="200" fill="none" stroke="white" stroke-dasharray="4" stroke-width="2" />
  <!-- Players -->
  <circle cx="200" cy="65" r="10" fill="%233b82f6" stroke="white" stroke-width="2" />
  <circle cx="200" cy="235" r="10" fill="%233b82f6" stroke="white" stroke-width="2" />
  <circle cx="115" cy="150" r="10" fill="%233b82f6" stroke="white" stroke-width="2" />
  <circle cx="285" cy="150" r="10" fill="%233b82f6" stroke="white" stroke-width="2" />
  
  <!-- Defenders (Rondo) -->
  <circle cx="180" cy="130" r="10" fill="%23ef4444" stroke="white" stroke-width="2" />
  <circle cx="220" cy="170" r="10" fill="%23ef4444" stroke="white" stroke-width="2" />
  
  <!-- Ball -->
  <circle cx="185" cy="85" r="5" fill="white" stroke="black" stroke-width="1" />
  <!-- Text label -->
  <text x="200" y="25" fill="white" font-family="sans-serif" font-size="14" text-anchor="middle" font-weight="bold">4v2 Transition Rondo</text>
</svg>`;

const DEFAULT_POSSESSION_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
  <rect width="400" height="300" fill="%2314532d" />
  <rect x="50" y="30" width="300" height="240" fill="none" stroke="white" stroke-width="2" />
  <!-- Inner zones -->
  <line x1="150" y1="30" x2="150" y2="270" stroke="white" stroke-dasharray="4" stroke-width="1" />
  <line x1="250" y1="30" x2="250" y2="270" stroke="white" stroke-dasharray="4" stroke-width="1" />
  
  <!-- Players (Attacking) -->
  <circle cx="90" cy="80" r="8" fill="%233b82f6" stroke="white" stroke-width="1.5" />
  <circle cx="130" cy="220" r="8" fill="%233b82f6" stroke="white" stroke-width="1.5" />
  <circle cx="200" cy="100" r="8" fill="%233b82f6" stroke="white" stroke-width="1.5" />
  <circle cx="270" cy="70" r="8" fill="%233b82f6" stroke="white" stroke-width="1.5" />
  <circle cx="310" cy="200" r="8" fill="%233b82f6" stroke="white" stroke-width="1.5" />

  <!-- Players (Defending) -->
  <circle cx="110" cy="120" r="8" fill="%23eab308" stroke="white" stroke-width="1.5" />
  <circle cx="170" cy="180" r="8" fill="%23eab308" stroke="white" stroke-width="1.5" />
  <circle cx="230" cy="80" r="8" fill="%23eab308" stroke="white" stroke-width="1.5" />
  <circle cx="290" cy="150" r="8" fill="%23eab308" stroke="white" stroke-width="1.5" />

  <!-- Neutrals (Jokers) -->
  <circle cx="200" cy="45" r="8" fill="%23a855f7" stroke="white" stroke-width="1.5" />
  <circle cx="200" cy="255" r="8" fill="%23a855f7" stroke="white" stroke-width="1.5" />
  <circle cx="200" cy="150" r="8" fill="%23a855f7" stroke="white" stroke-width="1.5" />

  <text x="200" y="20" fill="white" font-family="sans-serif" font-size="12" text-anchor="middle" font-weight="bold">6v6 + 3 Jokers</text>
</svg>`;

export const getDefaultSession = (): TrainingSession => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    id: 'default-u17-session',
    teamName: 'U17 Women Al Ula',
    date: `${yyyy}-${mm}-${dd}`,
    time: '18:30 - 20:00',
    sessionNumber: '42',
    microcycleDay: '-2',
    mainObjective: 'High collective press after losing the ball in the middle block and fast transition from attack to defense.',
    teamLogo: '',
    materialsNeeded: '20 Cones (10 Yellow, 10 Green), 12 Bibs (6 Blue, 6 Yellow), 15 Regulation Soccer Balls, 2 Portable Mini Goals, Stopwatch, Whistle.',
    warmUp: {
      id: 'warmup-block',
      title: 'Warm Up',
      exercises: [
        {
          id: 'ex-warmup-1',
          name: '4v2 Transition Rondo with Immediate Press',
          gameMoment: 'Transition A-D',
          subMoment: 'Counter-pressing immediately after losing possession (preventing outer pass)',
          description: 'A 4v2 rondo is played in a 10x10m square. If a defender wins the ball, they must immediately pass it to an outer target or make a safety pass. The 4 original attackers must execute a hyper-fast press to prevent the ball from escaping the square. If they win it back under 3 seconds, possession is maintained.',
          duration: '15 min',
          dimensions: '10x10 meters',
          coachRoles: 'Coach A: Monitors pass quality and body positioning.\nCoach B: Demands maximum intensity in the first 3 seconds post-turnover.',
          image: DEFAULT_RONDO_SVG,
          playerGroups: 'Group A (Blue Bibs): Sophia L., Valeria M., Marta G., Alba R.\nGroup B (Yellow Bibs): Luciana F., Carmen V., Irene S., Andrea O.'
        },
        {
          id: 'ex-warmup-2',
          name: 'Dynamic Warm-up & Joint Mobility',
          gameMoment: 'Other',
          subMoment: 'Neuromuscular preparation',
          description: 'Light continuous jogging in coordinated lines triggered by whistle signals. Progression to side shuffles, high knees, butt kicks, arm swings, and short accelerations (5 to 10 meters) to prepare joints. Concludes with active dynamic stretching.',
          duration: '10 min',
          dimensions: '20x15 meters',
          coachRoles: 'Fitness Coach: Leads the group rhythm and guides biomechanical exercises.',
          image: DEFAULT_TACTICAL_SVG,
          playerGroups: 'Full Squad (18 Players in two parallel lines)'
        }
      ]
    },
    mainPart: {
      id: 'main-block',
      title: 'Main Part',
      exercises: [
        {
          id: 'ex-main-1',
          name: '6v6 + 3 Jokers Positional Game',
          gameMoment: 'Attack',
          subMoment: 'Clean circulation, drawing in defenders & switching play',
          description: 'Maintain possession using artificial numerical superiority provided by the jokers (purple). The 3 jokers always play with the team in possession. Upon completing 8 consecutive passes, the attacking team can shoot into any of the 4 mini-goals in the corners. If the defending team intercepts, they become attackers and the jokers immediately join them.',
          duration: '25 min',
          dimensions: '40x30 meters',
          coachRoles: 'Coach A: Referees the game, feeds balls from the sides for high tempo.\nCoach B: Directs the defensive line on compact spacing and horizontal shifting.',
          image: DEFAULT_POSSESSION_SVG,
          playerGroups: 'Blue Team: Sophia, Valeria, Marta, Alba, Daniela, Julia\nYellow Team: Luciana, Carmen, Irene, Andrea, Elena, Sara\nJokers (Purple): Noa, Maria, Claudia'
        },
        {
          id: 'ex-main-2',
          name: 'Tactical Application Match (8v8)',
          gameMoment: 'Transition D-A',
          subMoment: 'Vertical counter-attacks & fullbacks overlapping',
          description: 'An 8v8 game (7 outfield players + 1 goalkeeper) on a reduced pitch from penalty box to penalty box. Special tactical rule: any goal scored within 10 seconds of winning the ball in the opponent\'s half counts as TRIPLE. This incentivizes immediate vertical transition and forward runs.',
          duration: '30 min',
          dimensions: 'Box-to-box reduced pitch',
          coachRoles: 'Coach A: Observes and evaluates Blue team\'s offensive transition speed.\nCoach B: Instructs Yellow team on emergency central block organization.',
          image: DEFAULT_TACTICAL_SVG,
          playerGroups: 'Blue Outfield: Valeria, Marta, Alba, Daniela, Julia, Noelia, Luciana + Sophia (GK)\nYellow Outfield: Carmen, Irene, Andrea, Elena, Sara, Paula, Noa + Maria (GK)'
        }
      ]
    },
    coolDown: {
      id: 'cooldown-block',
      title: 'Cool Down',
      exercises: [
        {
          id: 'ex-cooldown-1',
          name: 'Regenerative Jogging & Static Stretching',
          gameMoment: 'Other',
          subMoment: 'Physiological recovery',
          description: 'Slow, light jogging around the center circle for 3 minutes. Followed by a circle of static stretching targeting key muscle groups (hamstrings, quadriceps, calves) and deep hydration.',
          duration: '10 min',
          dimensions: 'Center Circle',
          coachRoles: 'Coaching Staff: Conducts a 5-minute feedback talk, reviewing objectives achieved and praising the team\'s effort.',
          image: DEFAULT_TACTICAL_SVG,
          playerGroups: 'Full Squad gathered in a circle'
        }
      ]
    },
    playerGroups: []
  };
};

export const getDefaultFitnessSession = (): TrainingSession => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    id: 'default-u17-fitness-session',
    teamName: 'U17 Women Al Ula',
    date: `${yyyy}-${mm}-${dd}`,
    time: '18:30 - 20:00',
    sessionNumber: '42',
    microcycleDay: '-2',
    mainObjective: 'High Intensity Interval Training (HIIT), change of direction, and core stabilization for athletic injury prevention.',
    teamLogo: '',
    materialsNeeded: '24 Agility Cones, 12 Agility Hurdles (low), 6 Resistance Bands, 10 Medicine Balls (3kg), Speed Ladders, Stopwatches.',
    warmUp: {
      id: 'warmup-block-fitness',
      title: 'Warm Up',
      exercises: [
        {
          id: 'ex-fitness-warmup-1',
          name: 'Dynamic Joint Mobility & Core Activation',
          gameMoment: 'Other',
          subMoment: 'Neuromuscular preparation',
          description: 'Joint mobility exercises starting from ankles to neck. Progression to dynamic planks (high to low), bird-dogs, and glute bridges. Concludes with leg swings and light walking lunges to prepare the muscular-skeletal system.',
          duration: '12 min',
          dimensions: 'Half Pitch',
          coachRoles: 'Fitness Coach: Corrects body alignment and posture during planks.\nAssistant Coach: Keeps the group rhythm in sync.',
          image: DEFAULT_TACTICAL_SVG,
          playerGroups: 'Full Squad in 3 lines of 6 players'
        }
      ]
    },
    mainPart: {
      id: 'main-block-fitness',
      title: 'Main Part',
      exercises: [
        {
          id: 'ex-fitness-main-1',
          name: 'HIIT Circuit & Agility Ladders',
          gameMoment: 'Other',
          subMoment: 'High intensity conditioning',
          description: '4 stations of high-intensity training:\n1) Agility ladder fast feet + 5m acceleration.\n2) Lateral hurdle jumps + short backpedal.\n3) Medicine ball slams + squat jumps.\n4) Resistance band resisted runs.\nWork time: 30 seconds, rest: 15 seconds. Repeat circuit 3 times.',
          duration: '25 min',
          dimensions: 'Penalty Area to Midfield',
          coachRoles: 'Fitness Coach: Blows whistle for station rotations and monitors exertion levels.\nCoaches: Support stations to motivate players and monitor technical execution.',
          image: DEFAULT_RONDO_SVG,
          playerGroups: 'Station 1: Groups 1 & 2\nStation 2: Groups 3 & 4\nStation 3: Group 5\nStation 4: Group 6'
        }
      ]
    },
    coolDown: {
      id: 'cooldown-block-fitness',
      title: 'Cool Down',
      exercises: [
        {
          id: 'ex-fitness-cooldown-1',
          name: 'Static Muscle Lengthening & Hydration',
          gameMoment: 'Other',
          subMoment: 'Physiological recovery',
          description: 'Static stretching targeting major muscles used (quadriceps, hamstrings, glutes, hip flexors). Deep breathing techniques and hydration. 5-minute debrief on physical load perception (RPE scale).',
          duration: '10 min',
          dimensions: 'Center Circle',
          coachRoles: 'Fitness Coach: Guides the breathing and stretches, collects RPE feedback.',
          image: DEFAULT_TACTICAL_SVG,
          playerGroups: 'Full Squad in a circle'
        }
      ]
    },
    playerGroups: []
  };
};

export const getEmptySession = (): TrainingSession => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    id: 'empty-session-' + Date.now(),
    teamName: 'U17 Women Al Ula',
    date: `${yyyy}-${mm}-${dd}`,
    time: '18:00 - 19:30',
    sessionNumber: '1',
    microcycleDay: '-1',
    mainObjective: '',
    teamLogo: '',
    materialsNeeded: '',
    warmUp: {
      id: 'warmup-block',
      title: 'Warm Up',
      exercises: []
    },
    mainPart: {
      id: 'main-block',
      title: 'Main Part',
      exercises: []
    },
    coolDown: {
      id: 'cooldown-block',
      title: 'Cool Down',
      exercises: []
    },
    playerGroups: []
  };
};
