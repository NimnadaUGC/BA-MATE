import { createContext, useContext } from 'react';
import type { EvaluationRun } from './types';
export const EvaluationContext = createContext<EvaluationRun | undefined>(undefined);
export const useEvaluation = () => useContext(EvaluationContext);
