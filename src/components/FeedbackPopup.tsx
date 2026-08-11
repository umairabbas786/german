import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import './FeedbackPopup.animations.css';

interface FeedbackPopupProps {
  isVisible: boolean;
  onClose: () => void;
  onSubmit: (feedback: string, stars: number) => Promise<void>;
}

const FeedbackPopup: React.FC<FeedbackPopupProps> = ({ isVisible, onClose, onSubmit }) => {
  const [selectedStars, setSelectedStars] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [hoveredStar, setHoveredStar] = useState<number>(0);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (selectedStars > 0 && !isSubmitting) {
      setIsSubmitting(true);
      try {
        await onSubmit(feedback, selectedStars);
        onClose();
      } catch (error) {
        console.error('Error submitting feedback:', error);
        // Still close the popup even if there's an error
        onClose();
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleStarClick = (starNumber: number) => {
    setSelectedStars(starNumber);
  };

  const handleStarHover = (starNumber: number) => {
    setHoveredStar(starNumber);
  };

  const handleStarLeave = () => {
    setHoveredStar(0);
  };

  if (!isVisible) return null;

  const canSubmit = selectedStars > 0 && !isSubmitting;

  return createPortal(
    <div className="fixed inset-0 z-[10000] box-border flex items-center justify-center bg-gradient-to-br from-black/40 to-black/30 p-5 backdrop-blur-[8px] max-[480px]:p-3">
      <div className="feedback-popup-animate relative max-h-[90vh] w-full max-w-[420px] overflow-hidden rounded-3xl border border-white/20 bg-white/85 shadow-[0_32px_64px_rgba(0,0,0,0.15),0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-[20px] max-[480px]:max-h-[95vh] max-[480px]:max-w-none max-[480px]:rounded-[20px]">
        <button
          type="button"
          className="absolute top-5 right-5 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-black/10 bg-black/5 text-lg text-black/60 backdrop-blur-[10px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-105 hover:bg-black/10 hover:text-black/80 hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] max-[480px]:top-4 max-[480px]:right-4 max-[480px]:h-8 max-[480px]:w-8"
          onClick={onClose}
        >
          ×
        </button>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto px-8 pt-10 pb-8 text-center max-[480px]:max-h-[calc(95vh-64px)] max-[480px]:px-6 max-[480px]:pt-8 max-[480px]:pb-6">
          <h3 className="m-0 mb-3 bg-gradient-to-br from-[#1a1a1a] to-[#4a4a4a] bg-clip-text text-2xl leading-tight font-bold tracking-[-0.02em] text-transparent max-[480px]:mb-2 max-[480px]:text-[22px]">
            We'd love your feedback!
          </h3>
          <p className="m-0 mb-8 text-[15px] leading-normal font-normal text-black/60 max-[480px]:mb-6 max-[480px]:text-sm">
            Help us improve this platform for you
          </p>

          <div className="mb-7 flex justify-center gap-3 py-4 max-[480px]:mb-5 max-[480px]:gap-2 max-[480px]:rounded-2xl max-[480px]:p-3">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= (hoveredStar || selectedStars);
              return (
                <button
                  key={star}
                  type="button"
                  className={[
                    'cursor-pointer rounded-xl border p-2 text-[32px] backdrop-blur-[5px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] hover:scale-[1.15] hover:rotate-5 hover:bg-white/20 hover:shadow-[0_8px_20px_rgba(0,0,0,0.1)] max-[480px]:p-1.5 max-[480px]:text-[28px]',
                    filled
                      ? 'border-[rgba(120,119,198,0.2)] bg-[rgba(120,119,198,0.1)] text-[#7877c6] shadow-[0_4px_12px_rgba(120,119,198,0.2)] hover:-rotate-5 hover:shadow-[0_8px_24px_rgba(120,119,198,0.3)]'
                      : 'border-black/10 bg-white/10 text-black/20',
                  ].join(' ')}
                  onClick={() => handleStarClick(star)}
                  onMouseEnter={() => handleStarHover(star)}
                  onMouseLeave={handleStarLeave}
                >
                  ★
                </button>
              );
            })}
          </div>

          <textarea
            className="mb-6 box-border min-h-[100px] w-full resize-y rounded-2xl border border-black/20 bg-transparent px-5 py-4 font-[inherit] text-[15px] leading-normal font-normal text-black/80 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] placeholder:font-normal placeholder:text-black/40 focus:translate-y-[-2px] focus:border-[rgba(120,119,198,0.4)] focus:bg-white/30 focus:shadow-[0_8px_32px_rgba(120,119,198,0.1),0_0_0_3px_rgba(120,119,198,0.1)] focus:outline-none max-[480px]:mb-5 max-[480px]:min-h-20 max-[480px]:rounded-xl max-[480px]:px-4 max-[480px]:py-3.5"
            placeholder="Tell us what you think (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />

          <button
            type="button"
            className={[
              'feedback-submit-glow relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-2xl border px-6 py-4 text-base font-semibold backdrop-blur-[12px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] max-[480px]:rounded-xl max-[480px]:px-5 max-[480px]:py-3.5 max-[480px]:text-[15px]',
              canSubmit
                ? 'cursor-pointer border-black/15 bg-[rgba(248,248,248,0.95)] text-black/80 shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:translate-y-[-3px] hover:scale-[1.02] hover:bg-[rgba(248,248,248,0.98)] hover:shadow-[0_12px_32px_rgba(0,0,0,0.15)] hover:[&_svg]:translate-x-0.5 active:translate-y-[-1px] active:scale-[0.98] active:shadow-[0_6px_20px_rgba(0,0,0,0.1)]'
                : 'feedback-submit-glow-disabled cursor-not-allowed border-transparent bg-black/10 text-black/30 shadow-none',
            ].join(' ')}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <>
                <div className="feedback-loading-spinner" />
                Sending...
              </>
            ) : (
              <>
                Send Feedback
                <svg
                  className="h-[18px] w-[18px] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M22 2L11 13"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M22 2L15 22L11 13L2 9L22 2Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default FeedbackPopup;
