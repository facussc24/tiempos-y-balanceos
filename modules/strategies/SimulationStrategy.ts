import { InjectionSimulationParams, InjectionScenario } from "../../types";

export interface SimulationStrategy {
    name: string;
    description: string;
    calculate(params: InjectionSimulationParams): InjectionScenario[];
}
