export function getOnboardingNextStepLabel(nextStepKey: string) {
  switch (nextStepKey) {
    case "facilities":
      return "Configure facilities";
    case "invitations":
      return "Process invitations";
    case "residents":
      return "Import residents";
    case "review_activation_queue":
      return "Review activation queue";
    case "units":
      return "Create units";
    case "complete":
      return "Complete setup";
    default:
      return "Continue setup";
  }
}
