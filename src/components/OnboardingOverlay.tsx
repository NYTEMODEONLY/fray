import { useEffect, useMemo, useState } from "react";

interface ChannelRecommendation {
  id: string;
  name: string;
}

interface OnboardingOverlayProps {
  step: number | null;
  spaceName: string;
  welcomeChannelName?: string;
  recommendedChannels: ChannelRecommendation[];
  recommendedRoles: string[];
  onOpenWelcome: () => void;
  onOpenChannel: (roomId: string) => void;
  onFocusComposer: () => void;
  onComplete: () => void;
}

const TOTAL_STEPS = 3;

export const OnboardingOverlay = ({
  step,
  spaceName,
  welcomeChannelName,
  recommendedChannels,
  recommendedRoles,
  onOpenWelcome,
  onOpenChannel,
  onFocusComposer,
  onComplete
}: OnboardingOverlayProps) => {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (step === null) return;
    setActiveStep(Math.min(Math.max(step, 0), TOTAL_STEPS - 1));
  }, [step]);

  const headline = useMemo(() => {
    if (activeStep === 0) return `Welcome to ${spaceName}`;
    if (activeStep === 1) return "Recommended first stops";
    return "Send your first message";
  }, [activeStep, spaceName]);

  if (step === null) return null;

  return (
    <div className="onboarding">
      <div className="onboarding-card phase5">
        <p className="eyebrow">Quick Start</p>
        <h2>{headline}</h2>

        {activeStep === 0 && (
          <>
            <p>
              Start in <strong>#{welcomeChannelName ?? "welcome"}</strong> to see rules,
              announcements, and onboarding notes.
            </p>
            <div className="onboarding-actions">
              <button className="primary" onClick={onOpenWelcome}>
                Take Me to Welcome
              </button>
              <button className="pill" onClick={() => setActiveStep(1)}>
                Next
              </button>
            </div>
          </>
        )}

        {activeStep === 1 && (
          <>
            <p>Jump into these channels to get context quickly.</p>
            <div className="onboarding-chip-list">
              {recommendedChannels.length === 0 && <span className="empty">No recommendations yet.</span>}
              {recommendedChannels.map((channel) => (
                <button
                  key={channel.id}
                  className="pill"
                  onClick={() => onOpenChannel(channel.id)}
                >
                  #{channel.name}
                </button>
              ))}
            </div>
            <p>Common roles in this server: {recommendedRoles.join(", ") || "Member"}</p>
            <div className="onboarding-actions">
              <button className="pill" onClick={() => setActiveStep(0)}>
                Back
              </button>
              <button className="primary" onClick={() => setActiveStep(2)}>
                Continue
              </button>
            </div>
          </>
        )}

        {activeStep === 2 && (
          <>
            <p>
              You are ready to chat. Open the composer and send your first message to finish setup.
            </p>
            <div className="onboarding-actions">
              <button className="primary" onClick={onFocusComposer}>
                Focus Composer
              </button>
              <button className="pill" onClick={onComplete}>
                Skip Onboarding
              </button>
            </div>
          </>
        )}

        <div className="onboarding-progress" aria-label="Onboarding progress">
          {Array.from({ length: TOTAL_STEPS }, (_, index) => (
            <span key={index} className={index <= activeStep ? "active" : ""} />
          ))}
        </div>
      </div>
    </div>
  );
};
