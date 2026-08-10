import React from "react";
import { useAdminProductRatings } from "../helpers/useProductRatings";
import { Star } from "lucide-react";
import styles from "./AdminProductRatings.module.css";

const StarRating = ({ value }: { value: number }) => {
  const fullStars = Math.round(value);
  return (
    <div className={styles.starRating}>
      <div className={styles.stars}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={star <= fullStars ? styles.starFilled : styles.starEmpty}
          />
        ))}
      </div>
      <span className={styles.ratingValue}>{value.toFixed(1)}</span>
    </div>
  );
};

export const AdminProductRatings = () => {
  const { data: ratings, isLoading } = useAdminProductRatings();

  if (isLoading) {
    return (
      <div className={styles.viewContainer}>
        <p className={styles.emptyState}>Lade Bewertungen...</p>
      </div>
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Artikel Bewertungen</h2>
      </div>

      {!ratings || ratings.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Noch keine Bewertungen vorhanden.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Art. Nr</th>
                <th>Geschmack</th>
                <th>Qualität</th>
                <th>Preis</th>
                <th>Bewertungen</th>
              </tr>
            </thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={r.productId}>
                  <td>{r.productName}</td>
                  <td>{r.articleNumber}</td>
                  <td>
                    <StarRating value={r.avgTaste} />
                  </td>
                  <td>
                    <StarRating value={r.avgQuality} />
                  </td>
                  <td>
                    <StarRating value={r.avgPrice} />
                  </td>
                  <td>{r.totalRatings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};