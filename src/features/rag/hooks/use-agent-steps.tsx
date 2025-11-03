import {
  useState,
  useCallback,
  createContext,
  useContext,
  ReactNode
} from "react";

// ============================================================================
// INTERFACE du contexte
// ============================================================================
interface AgentStepsContextType {
  agentSteps: string[];
  isDisplayingSteps: boolean;
  addStep: (step: string) => void;
  resetSteps: () => void;
  updateSteps: (steps: string[]) => void;
}

const AgentStepsContext = createContext<AgentStepsContextType | undefined>(
  undefined
);

// ============================================================================
// PROVIDER - Encapsule l'application
// ============================================================================
export const AgentStepsProvider = ({ children }: { children: ReactNode }) => {
  const [agentSteps, setAgentSteps] = useState<string[]>([]);
  const [isDisplayingSteps, setIsDisplayingSteps] = useState(false);

  /**
   * Ajoute un step à la fin de la liste (pour streaming progressif)
   */
  const addStep = useCallback((step: string) => {
    setAgentSteps(prev => [...prev, step]);
    setIsDisplayingSteps(true);
  }, []);

  /**
   * Reset tous les steps (avant une nouvelle query)
   */
  const resetSteps = useCallback(() => {
    setAgentSteps([]);
    setIsDisplayingSteps(false);
  }, []);

  /**
   * Remplace tous les steps d'un coup (quand on reçoit un array complet)
   */
  const updateSteps = useCallback((steps: string[]) => {
    setAgentSteps(steps);
    setIsDisplayingSteps(steps.length > 0);
  }, []);

  return (
    <AgentStepsContext.Provider
      value={{
        agentSteps,
        isDisplayingSteps,
        addStep,
        resetSteps,
        updateSteps
      }}
    >
      {children}
    </AgentStepsContext.Provider>
  );
};

// ============================================================================
// HOOK - Utilise le contexte
// ============================================================================
export const useAgentSteps = () => {
  const context = useContext(AgentStepsContext);
  
  if (context === undefined) {
    // Fallback si utilisé en dehors du Provider
    console.warn(
      "useAgentSteps used outside AgentStepsProvider, returning fallback"
    );
    return {
      agentSteps: [],
      isDisplayingSteps: false,
      addStep: () => {},
      resetSteps: () => {},
      updateSteps: () => {}
    };
  }
  
  return context;
};