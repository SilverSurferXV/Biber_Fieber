import React from "react";
import { Spinner } from "./Spinner";
import styles from "./NativeWalletButton.module.css";

export interface NativeWalletButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  kind: "apple_pay" | "google_pay";
  isProcessing?: boolean;
}

export const NativeWalletButton = React.forwardRef<HTMLButtonElement, NativeWalletButtonProps>(
  ({ kind, onClick, disabled, isProcessing, className, ...props }, ref) => {
    const isDisabled = disabled || isProcessing;

    return (
      <button
        ref={ref}
        type="button"
        className={`${styles.walletButton} ${isDisabled ? styles.disabled : ""} ${className || ""}`}
        onClick={onClick}
        disabled={isDisabled}
        aria-busy={isProcessing}
        aria-label={kind === "apple_pay" ? "Mit Apple Pay bezahlen" : "Mit Google Pay bezahlen"}
        {...props}
      >
        {isProcessing ? (
          <Spinner size="md" className={styles.spinner} />
        ) : kind === "apple_pay" ? (
          <div className={styles.content}>
            <svg
              className={styles.appleLogo}
              viewBox="0 0 384 512"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M318.7 268c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-36.8-2.8-77 21.5-91.7 21.5-15.5 0-51.1-20.5-79.1-20.5C56.7 141.2 0 184.6 0 273.2c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 62.8 133.7 106.4 132.3 22.9-.6 39-16.3 68.7-16.3 28.9 0 43.8 15.7 69.4 15.7 44-.6 89.3-88.9 101.4-125.7-58.9-27.8-41.6-92.1-41.6-92.4zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 35-17.5 19.9-27.8 44.5-25.6 72 26.1 2 49.9-11.4 69.5-34.5z" />
            </svg>
            <span className={styles.payText}>Pay</span>
          </div>
        ) : (
          <div className={styles.content}>
            <svg
              className={styles.googleLogo}
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
              <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
              <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
              <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
            </svg>
            <span className={styles.payText}>Pay</span>
          </div>
        )}
      </button>
    );
  }
);

NativeWalletButton.displayName = "NativeWalletButton";