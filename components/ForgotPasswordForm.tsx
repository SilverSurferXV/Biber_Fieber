import React, { useState } from "react";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import {
  schema,
  postForgotPassword,
} from "../endpoints/auth/forgot-password_POST.schema";
import { useTranslation } from "../helpers/useTranslation";
import styles from "./ForgotPasswordForm.module.css";

interface ForgotPasswordFormProps {
  className?: string;
  onBack: () => void;
}

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  className,
  onBack,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { t } = useTranslation();

  const form = useForm({
    defaultValues: {
      email: "",
    },
    schema,
  });

  const handleSubmit = async (data: z.infer<typeof schema>) => {
    setError(null);
    setIsLoading(true);

    try {
      await postForgotPassword(data);
      setSuccess(true);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError(
        err instanceof Error
          ? err.message
          : t('forgot_password.error')
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={`${styles.container} ${className || ""}`}>
        <p className={styles.successMessage}>
          {t('forgot_password.success')}
        </p>
        <div
          className={styles.backLink}
          onClick={onBack}
          role="button"
          tabIndex={0}
        >
          {t('forgot_password.back_to_login')}
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        <h3 className={styles.title}>{t('forgot_password.title')}</h3>

        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="email">
          <FormLabel>{t('forgot_password.email')}</FormLabel>
          <FormControl>
            <Input
              placeholder="your@email.com"
              type="email"
              autoComplete="email"
              disabled={isLoading}
              value={form.values.email}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, email: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitButton}
        >
          {isLoading ? (
            <span className={styles.loadingText}>
              <Spinner className={styles.spinner} size="sm" />
              {t('forgot_password.sending')}
            </span>
          ) : (
            t('forgot_password.send_link')
          )}
        </Button>

        <div
          className={styles.backLink}
          onClick={onBack}
          role="button"
          tabIndex={0}
        >
          {t('forgot_password.back_to_login')}
        </div>
      </form>
    </Form>
  );
};