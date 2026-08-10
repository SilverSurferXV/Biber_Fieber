import React, { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription, 
  DialogTrigger, 
  DialogFooter 
} from "./Dialog";
import { Button } from "./Button";
import { Star } from "lucide-react";
import { useAuth } from "../helpers/useAuth";
import { useSubmitProductRating } from "../helpers/useProductRatings";
import { useTranslation } from "../helpers/useTranslation";
import { toast } from "sonner";
import styles from "./ProductRatingDialog.module.css";

interface ProductRatingDialogProps {
  productId: number;
  productName: string;
  hasRated?: boolean;
  existingRating?: { tasteRating: number; qualityRating: number; priceRating: number };
  children: React.ReactNode;
}

export const ProductRatingDialog: React.FC<ProductRatingDialogProps> = ({ 
  productId, 
  productName,
  hasRated,
  existingRating,
  children 
}) => {
  const { authState } = useAuth();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  
  const [taste, setTaste] = useState(0);
  const [quality, setQuality] = useState(0);
  const [price, setPrice] = useState(0);

  const [hoverTaste, setHoverTaste] = useState(0);
  const [hoverQuality, setHoverQuality] = useState(0);
  const [hoverPrice, setHoverPrice] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (existingRating) {
        setTaste(existingRating.tasteRating);
        setQuality(existingRating.qualityRating);
        setPrice(existingRating.priceRating);
      } else {
        setTaste(0);
        setQuality(0);
        setPrice(0);
      }
    }
  }, [isOpen, existingRating]);

  const submitMutation = useSubmitProductRating();

  const handleSubmit = () => {
    if (taste === 0 || quality === 0 || price === 0) {
      toast.error(t("rating.instruction"));
      return;
    }
    submitMutation.mutate(
      { productId, tasteRating: taste, qualityRating: quality, priceRating: price },
      {
        onSuccess: () => {
          toast.success(t("rating.success"));
          setIsOpen(false);
          setTaste(0);
          setQuality(0);
          setPrice(0);
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : t('rating.save_error'));
        }
      }
    );
  };

  const renderStars = (
    value: number,
    hoverValue: number,
    onClick: (v: number) => void,
    onHover: (v: number) => void
  ) => {
    return (
      <div className={styles.starContainer} onMouseLeave={() => onHover(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const isFilled = star <= (hoverValue || value);
          return (
            <button
              key={star}
              type="button"
              className={styles.starBtn}
              onClick={() => onClick(star)}
              onMouseEnter={() => onHover(star)}
              aria-label={`${star} Sterne`}
            >
              <Star
                size={24}
                className={isFilled ? styles.starFilled : styles.starEmpty}
                fill={isFilled ? "currentColor" : "none"}
              />
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("rating.title")}</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>

        <div className={styles.content}>
          {authState.type !== "authenticated" ? (
            <div className={styles.unauthMessage}>
              {t("rating.login_required")}
            </div>
          ) : (
            <div className={styles.ratingForm}>
              <div className={styles.ratingRow}>
                <span className={styles.ratingLabel}>{t("rating.taste")}</span>
                {renderStars(taste, hoverTaste, setTaste, setHoverTaste)}
              </div>
              <div className={styles.ratingRow}>
                <span className={styles.ratingLabel}>{t("rating.quality")}</span>
                {renderStars(quality, hoverQuality, setQuality, setHoverQuality)}
              </div>
              <div className={styles.ratingRow}>
                <span className={styles.ratingLabel}>{t("rating.price")}</span>
                {renderStars(price, hoverPrice, setPrice, setHoverPrice)}
              </div>
            </div>
          )}
        </div>

        {authState.type === "authenticated" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>{t("profile.cancel")}</Button>
            <Button onClick={handleSubmit} disabled={submitMutation.isPending}>
              {submitMutation.isPending ? t("rating.saving") : t("rating.submit")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
};