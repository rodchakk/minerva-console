export function getOnboardingNextStepLabel(nextStepKey: string) {
  switch (nextStepKey) {
    case "admins":
    case "staff":
      return "Assign resident admin";
    case "details":
      return "Complete details";
    case "facilities":
      return "Configure facilities";
    case "features":
      return "Configure features";
    case "final_review":
      return "Final readiness check";
    case "invitations":
      return "Process invitations";
    case "residents":
      return "Import residents";
    case "review_activation_queue":
    case "activation_queue":
      return "Review activation queue";
    case "units":
      return "Create units";
    case "complete":
      return "Complete setup";
    default:
      return "Continue setup";
  }
}
