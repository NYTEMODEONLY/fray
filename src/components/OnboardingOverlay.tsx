interface OnboardingOverlayProps {
  step: number | null;
  onComplete: () => void;
}

const steps = [
  {
    title: "Welcome to Fray",
    body: "Start in #welcome. We highlight the essentials and collapse the noise."
  },
  {
    title: "Stay focused",
    body: "Use the smart unread feed and pins to keep momentum."
  },
  {
    title: "Join voice",
    body: "MatrixRTC keeps voice and video always-on and privacy-first."
  }
];

export const OnboardingOverlay = ({ step, onComplete }: OnboardingOverlayProps) => {
  if (step === null) return null;
  const current = steps[Math.min(step, steps.length - 1)];

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <p className="eyebrow">Quick Start</p>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="onboarding-actions">
          <button className="primary" onClick={onComplete}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
