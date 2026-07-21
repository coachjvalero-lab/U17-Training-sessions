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
  <text x="200" y="25" fill="white" font-family="sans-serif" font-size="14" text-anchor="middle" font-weight="bold">Rondo de Transición 4v2</text>
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

  <text x="200" y="20" fill="white" font-family="sans-serif" font-size="12" text-anchor="middle" font-weight="bold">6v6 + 3 Comodines</text>
</svg>`;

export const getDefaultSession = (): TrainingSession => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    id: 'default-u17-session',
    teamName: 'U17 Femenino A.D. San Pedro',
    date: `${yyyy}-${mm}-${dd}`,
    time: '18:30 - 20:00',
    sessionNumber: '42',
    mainObjective: 'Presión alta colectiva tras pérdida de balón en bloque medio y transiciones rápidas ataque-defensa.',
    teamLogo: '',
    materialsNeeded: '20 Conos (10 Amarillos, 10 Verdes), 12 Petos (6 Azules, 6 Amarillos), 15 Balones reglamentarios, 2 Porterías móviles adicionales, Cronómetro, Silbato.',
    warmUp: {
      id: 'warmup-block',
      title: 'Warm-up / Calentamiento (Activación)',
      exercises: [
        {
          id: 'ex-warmup-1',
          name: 'Rondo de Transición 4v2 con Presión Inmediata',
          gameMoment: 'Transición A-D',
          subMoment: 'Presión tras pérdida de balón inmediata (evitar pase exterior)',
          description: 'Se juega un rondo de 4 atacantes contra 2 defensores en un cuadrante de 10x10 metros. Si un defensor roba el balón, debe pasar inmediatamente a un tercer compañero exterior o realizar un pase de seguridad. Los 4 atacantes originales deben realizar una presión ultra-rápida y asfixiante para evitar que el balón salga del cuadrado. Si logran presionar y recuperar en menos de 3 segundos, se mantiene el rondo.',
          duration: '15 min',
          dimensions: '10x10 metros',
          coachRoles: 'Coach A: Monitorea la calidad técnica de los pases. Coach B: Exige máxima intensidad física en los primeros 3 segundos post-pérdida.',
          image: DEFAULT_RONDO_SVG
        },
        {
          id: 'ex-warmup-2',
          name: 'Activación Dinámica y Movilidad Articular',
          gameMoment: 'Otro',
          subMoment: 'Preparación neuromuscular',
          description: 'Carrera continua suave en hileras coordinadas por silbato. Progresión a movimientos laterales, saltos de cabeza simulados, skip bajo/alto, talones atrás, y aceleraciones cortas (de 5 a 10 metros) para preparar las articulaciones. Finaliza con estiramientos activos dinámicos.',
          duration: '10 min',
          dimensions: '20x15 metros',
          coachRoles: 'Preparador Físico: Lidera el ritmo e indica el tipo de ejercicio biomecánico.',
          image: DEFAULT_TACTICAL_SVG
        }
      ]
    },
    mainPart: {
      id: 'main-block',
      title: 'Parte Principal (Táctica / Aplicación)',
      exercises: [
        {
          id: 'ex-main-1',
          name: 'Juego de Posición 6v6 + 3 Comodines (Pivote, Interior y Central)',
          gameMoment: 'Ataque',
          subMoment: 'Circulación limpia, fijar defensores y alternar amplitud',
          description: 'Mantener la posesión del esférico mediante superioridad numérica artificial dada por los comodines (morados). Los 3 comodines juegan siempre con el equipo poseedor. Al alcanzar 8 pases consecutivos de un lado a otro del espacio, el equipo atacante puede buscar meter gol en cualquiera de las 4 mini-porterías situadas en las esquinas. Si el equipo defensor intercepta el balón, se convierte automáticamente en atacante y los comodines se unen a ellos.',
          duration: '25 min',
          dimensions: '40x30 metros',
          coachRoles: 'Coach A: Silbato para infracciones, reponer balones rápido en los laterales. Coach B: Corrige el posicionamiento corporal de perfil de las centrocampistas.',
          image: DEFAULT_POSSESSION_SVG
        },
        {
          id: 'ex-main-2',
          name: 'Partido de Aplicación Táctica Colectiva',
          gameMoment: 'Transición D-A',
          subMoment: 'Contraataque vertical e incorporación de carrileras',
          description: 'Se disputa un encuentro de fútbol 8v8 (7 jugadoras de campo y 1 portera) en campo reducido de área a área. Regla táctica especial: todo gol que se convierta en los primeros 10 segundos tras haber robado el balón en campo contrario valdrá por TRIPLE. Esto incentiva las transiciones verticales inmediatas y el desmarque de ruptura de las delanteras.',
          duration: '30 min',
          dimensions: 'Campo reducido (área a área)',
          coachRoles: 'Coach A: Observa la transición del equipo azul. Coach B: Da instrucciones tácticas en vivo al equipo amarillo sobre repliegue de emergencia.',
          image: DEFAULT_TACTICAL_SVG
        }
      ]
    },
    coolDown: {
      id: 'cooldown-block',
      title: 'Cool Down / Vuelta a la Calma',
      exercises: [
        {
          id: 'ex-cooldown-1',
          name: 'Trote Regenerativo y Estiramientos Estáticos Auto-asistidos',
          gameMoment: 'Otro',
          subMoment: 'Recuperación fisiológica',
          description: 'Carrera lenta y decreciente alrededor del círculo central durante 3 minutos. Seguidamente, se realiza un círculo de estiramientos de los principales grupos musculares (isquiotibiales, cuádriceps, gemelos). Aprovechar el momento para hidratación profunda.',
          duration: '10 min',
          dimensions: 'Círculo Central',
          coachRoles: 'Staff completo: Charla breve de retroalimentación de 5 minutos analizando el cumplimiento de los objetivos de la sesión y felicitando el esfuerzo del grupo.',
          image: DEFAULT_TACTICAL_SVG
        }
      ]
    },
    playerGroups: [
      {
        id: 'group-1',
        groupNumber: 1,
        bibColor: '#22c55e', // Emerald
        players: 'Sofía L. (GK), Valeria M., Marta G., Alba R., Daniela P., Julia S., Noelia T.'
      },
      {
        id: 'group-2',
        groupNumber: 2,
        bibColor: '#3b82f6', // Blue
        players: 'Lucía F., Carmen V., Irene S., Andrea O., Elena M., Sara C., Paula G.'
      },
      {
        id: 'group-3',
        groupNumber: 3,
        bibColor: '#eab308', // Yellow
        players: 'Noa J., María B., Claudia R., Paula M., Carla D., Jimena G., Adriana P.'
      }
    ]
  };
};

export const getEmptySession = (): TrainingSession => {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  
  return {
    id: 'empty-session-' + Date.now(),
    teamName: 'U17',
    date: `${yyyy}-${mm}-${dd}`,
    time: '18:00 - 19:30',
    sessionNumber: '1',
    mainObjective: '',
    teamLogo: '',
    materialsNeeded: '',
    warmUp: {
      id: 'warmup-block',
      title: 'Warm-up / Calentamiento (Activación)',
      exercises: []
    },
    mainPart: {
      id: 'main-block',
      title: 'Parte Principal (Táctica / Aplicación)',
      exercises: []
    },
    coolDown: {
      id: 'cooldown-block',
      title: 'Cool Down / Vuelta a la Calma',
      exercises: []
    },
    playerGroups: []
  };
};
