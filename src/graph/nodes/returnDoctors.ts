import { AppointmentService } from "../../services/appointmentService.ts";
import type { GraphState } from "../graph.ts";

export function createReturnDoctorsNode(
  appointmentService: AppointmentService,
) {
  return async (state: GraphState): Promise<Partial<GraphState>> => {
    const availableProfessionals = appointmentService.getProfessionals();
    return {
      ...state,
      actionSuccess: true,
      availableProfessionals,
    };
  };
}
