import {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode
} from "react";

// Interface pour le contexte des étapes d'agent
interface AgentStepsContextType {
  agentSteps: string[];
  isDisplayingSteps: boolean;
  addStep: (step: string) => void;
  resetSteps: () => void;
  updateSteps: (steps: string[]) => void;
  setAgentSteps: React.Dispatch<React.SetStateAction<string[]>>;
  displayStepsProgressively: (steps: string[]) => Promise<void>;
}

const AgentStepsContext = createContext<AgentStepsContextType | undefined>(
  undefined
);

// Provider pour encapsuler l'application
export const AgentStepsProvider = ({ children }: { children: ReactNode }) => {
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [isDisplayingSteps, setIsDisplayingSteps] = useState(false);

  const addStep = useCallback((step: string) => {
    setAgentSteps(prev => [...prev, step]);
  }, []);

  const resetSteps = useCallback(() => {
    setAgentSteps([]);
    setIsDisplayingSteps(false);
  }, []);

  const updateSteps = useCallback((steps: string[]) => {
    setAgentSteps(steps);
  }, []);

  // Fonction pour afficher les étapes de manière progressive
  const displayStepsProgressively = useCallback(async (steps: string[]) => {
    if (!steps || steps.length === 0) return;

    setIsDisplayingSteps(true);
    setAgentSteps([]);

    // Afficher les vraies étapes de l'agent progressivement
    for (const step of steps) {
      setAgentSteps(prev => [...prev, step]);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    setIsDisplayingSteps(false);
  }, []);

  return (
    <AgentStepsContext.Provider
      value={{
        agentSteps,
        isDisplayingSteps,
        addStep,
        resetSteps,
        updateSteps,
        setAgentSteps,
        displayStepsProgressively
      }}
    >
      {children}
    </AgentStepsContext.Provider>
  );
};

export const useAgentSteps = () => {
  const context = useContext(AgentStepsContext);
  if (context === undefined) {
    // Version de fallback si le contexte n'est pas disponible
    console.warn(
      "useAgentSteps used outside AgentStepsProvider, returning fallback"
    );
    return {
      agentSteps: [],
      isDisplayingSteps: false,
      addStep: () => {},
      resetSteps: () => {},
      updateSteps: () => {},
      setAgentSteps: () => {},
      displayStepsProgressively: async () => {}
    };
  }
  return context;
};
