// The concept graph for Photosynthesis, sized for grades 6–10.
// Mastery is tracked per-objective; the analyzer scores the student's answers
// against these, and the tutor probes whichever objectives are still weak.

export interface Objective {
  id: string;
  title: string;
  /** What "mastered" looks like — the analyzer's rubric, not shown verbatim. */
  masteryCriterion: string;
}

export interface Misconception {
  id: string;
  belief: string;
  reality: string;
}

export interface Concept {
  id: string;
  title: string;
  objectives: Objective[];
  misconceptions: Misconception[];
}

export const PHOTOSYNTHESIS: Concept = {
  id: "photosynthesis",
  title: "Photosynthesis",
  objectives: [
    {
      id: "purpose",
      title: "Plants make their own food",
      masteryCriterion:
        "Understands a plant produces its own food/energy rather than absorbing ready-made food.",
    },
    {
      id: "inputs",
      title: "Inputs: carbon dioxide, water, light",
      masteryCriterion:
        "Names carbon dioxide (from air), water (from roots), and light as the required inputs.",
    },
    {
      id: "outputs",
      title: "Outputs: glucose and oxygen",
      masteryCriterion:
        "Knows the process produces glucose (stored energy) and releases oxygen.",
    },
    {
      id: "location",
      title: "Where it happens",
      masteryCriterion:
        "Locates it in leaves/chloroplasts and links chlorophyll to capturing light.",
    },
    {
      id: "transformation",
      title: "Light energy becomes chemical energy",
      masteryCriterion:
        "Explains that light energy is converted into chemical energy stored in glucose.",
    },
    {
      id: "significance",
      title: "Why it matters",
      masteryCriterion:
        "Connects photosynthesis to food chains and to the oxygen animals breathe.",
    },
  ],
  misconceptions: [
    {
      id: "soil_food",
      belief: "Plants get their food from the soil.",
      reality:
        "Plants absorb water and minerals from soil, but make their own food from CO2, water, and light.",
    },
    {
      id: "mass_from_soil",
      belief: "A plant's material/mass comes mainly from the soil.",
      reality:
        "Most of a plant's dry mass comes from carbon captured out of CO2 in the air.",
    },
    {
      id: "night_respiration",
      belief: "Plants only respire at night / do not respire.",
      reality:
        "Plants respire all the time; they only photosynthesize when there is light.",
    },
    {
      id: "light_optional",
      belief: "Plants just need water and soil, not light, to make food.",
      reality: "Light is an essential energy source for photosynthesis.",
    },
    {
      id: "photo_eq_resp",
      belief: "Photosynthesis and respiration are the same thing.",
      reality:
        "They are opposite processes: photosynthesis stores energy, respiration releases it.",
    },
  ],
};
