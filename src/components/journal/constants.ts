export const MOOD_LABELS: Record<number, string> = {
  1: "Agotado",
  2: "Bajo",
  3: "Normal",
  4: "Bien",
  5: "Pleno",
};

export const EMOTIONS = [
  "calma",
  "alegría",
  "gratitud",
  "motivación",
  "foco",
  "cansancio",
  "ansiedad",
  "estrés",
  "tristeza",
  "frustración",
];

export const REFLECTION_QUESTIONS = [
  {
    field: "q_gratitude",
    title: "Gratitud / Victoria",
    prompt: "¿Qué salió bien hoy o qué agradezco?",
  },
  {
    field: "q_challenge",
    title: "Conciencia",
    prompt: "¿Qué emoción o pensamiento difícil predominó y cómo lo gestioné?",
  },
  {
    field: "q_learning",
    title: "Aprendizaje",
    prompt: "¿Qué haré diferente o mejor mañana?",
  },
] as const;

export type TextField = "free_journal" | "q_gratitude" | "q_challenge" | "q_learning";
