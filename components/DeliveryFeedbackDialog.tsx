import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { Button } from "./Button";
import { Star } from "lucide-react";
import { toast } from "sonner";
import {
  useDeliveryFeedbackPending,
  useSubmitDeliveryFeedback,
} from "../helpers/useDeliveryFeedback";
import { resolveFileUrl } from "../helpers/resolveFileUrl";
import { useTranslation } from "../helpers/useTranslation";
import styles from "./DeliveryFeedbackDialog.module.css";

export function DeliveryFeedbackDialog() {
  const { data: pendingFeedbacks, isFetching } = useDeliveryFeedbackPending();
  const { t } = useTranslation();
  const submitMutation = useSubmitDeliveryFeedback();

  const [isDismissed, setIsDismissed] = useState(false);
  const [tipAmount, setTipAmount] = useState<0 | 0.5 | 1 | 2>(0);
  const [cleanRating, setCleanRating] = useState(0);
  const [noiseRating, setNoiseRating] = useState(0);
  const [placementRating, setPlacementRating] = useState(0);

  const pendingFeedback = pendingFeedbacks?.[0];
  const isOpen = !!pendingFeedback && !isDismissed;

  // Reset state when a new feedback item appears
  useEffect(() => {
    if (pendingFeedback) {
      setTipAmount(0);
      setCleanRating(0);
      setNoiseRating(0);
      setPlacementRating(0);
    }
  }, [pendingFeedback?.orderId]);

  if (!pendingFeedback) return null;

  const handleTipToggle = (amount: 0.5 | 1 | 2) => {
    setTipAmount((prev) => (prev === amount ? 0 : amount));
  };

  const handleSubmit = async () => {
    if (cleanRating === 0 || noiseRating === 0 || placementRating === 0) {
      toast.error(t('feedback.rate_all_error'));
      return;
    }

    try {
      await submitMutation.mutateAsync({
        orderId: pendingFeedback.orderId,
        tipAmount,
        cleanRating,
        noiseRating,
        placementRating,
      });
      toast.success(t('feedback.thanks'));
      // The successful mutation will invalidate the pending feedbacks query,
      // and the next one (if any) will automatically show up.
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t('feedback.send_error')
      );
    }
  };

  const handleCancel = () => {
    setIsDismissed(true);
  };

  const renderStars = (
    rating: number,
    setRating: React.Dispatch<React.SetStateAction<number>>
  ) => {
    return (
      <div className={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            className={styles.starButton}
            onClick={() => setRating(star)}
            onMouseEnter={(e) => {
              const siblings = Array.from(e.currentTarget.parentElement?.children || []);
              siblings.forEach((btn, index) => {
                if (index < star) {
                  btn.classList.add(styles.starHover);
                } else {
                  btn.classList.remove(styles.starHover);
                }
              });
            }}
            onMouseLeave={(e) => {
              const siblings = Array.from(e.currentTarget.parentElement?.children || []);
              siblings.forEach((btn) => {
                btn.classList.remove(styles.starHover);
              });
            }}
          >
            <Star
              className={`${styles.starIcon} ${
                star <= rating ? styles.starFilled : ""
              }`}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent
        className={styles.dialogContent}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className={styles.innerContainer}>
          <DialogHeader>
            <DialogTitle className={styles.title}>
              {t('feedback.title')}
            </DialogTitle>
            <DialogDescription className={styles.greetingText}>
              {t('feedback.greeting')}
            </DialogDescription>
          </DialogHeader>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('feedback.tip_title')}</div>
            <div className={styles.tipButtonsRow}>
              <Button
                variant={tipAmount === 0.5 ? "primary" : "outline"}
                className={`${styles.tipButton} ${
                  tipAmount === 0.5 ? styles.tipActive : ""
                }`}
                onClick={() => handleTipToggle(0.5)}
                disabled={submitMutation.isPending}
              >
                0,50€
                {tipAmount === 0.5 && (
                  <img src={resolveFileUrl("/_cdn/static/1f64f.png")} alt="Danke" className={styles.dankeEmoji} />
                )}
              </Button>
              <Button
                variant={tipAmount === 1 ? "primary" : "outline"}
                className={`${styles.tipButton} ${
                  tipAmount === 1 ? styles.tipActive : ""
                }`}
                onClick={() => handleTipToggle(1)}
                disabled={submitMutation.isPending}
              >
                1,00€
                {tipAmount === 1 && (
                  <img src={resolveFileUrl("/_cdn/static/1f64f.png")} alt="Danke" className={styles.dankeEmoji} />
                )}
              </Button>
              <Button
                variant={tipAmount === 2 ? "primary" : "primary"}
                className={`${styles.tipButton} ${
                  tipAmount === 2 ? styles.tipActive : ""
                } ${tipAmount !== 2 ? styles.tipInactiveOutline : ""}`}
                onClick={() => handleTipToggle(2)}
                disabled={submitMutation.isPending}
              >
                2,00€
                {tipAmount === 2 && (
                  <img src={resolveFileUrl("/_cdn/static/1f64f.png")} alt="Danke" className={styles.dankeEmoji} />
                )}
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionTitle}>{t('feedback.rating_title')}</div>
            <div className={styles.questionBlock}>
              <div className={styles.questionText}>
                {t('feedback.clean_question')}
              </div>
              {renderStars(cleanRating, setCleanRating)}
            </div>
            <div className={styles.questionBlock}>
              <div className={styles.questionText}>
                {t('feedback.noise_question')}
              </div>
              {renderStars(noiseRating, setNoiseRating)}
            </div>
            <div className={styles.questionBlock}>
              <div className={styles.questionText}>
                {t('feedback.placement_question')}
              </div>
              {renderStars(placementRating, setPlacementRating)}
            </div>
          </div>

          <DialogFooter className={styles.footer}>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={submitMutation.isPending}
              className={styles.actionButton}
            >
              {t('feedback.cancel')}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending}
              className={styles.actionButton}
            >
              {submitMutation.isPending ? t('feedback.sending') : t('feedback.send')}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}