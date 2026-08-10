import React, { useState } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
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
  postLogin,
} from "../endpoints/auth/login_with_password_POST.schema";
import { useAuth } from "../helpers/useAuth";
import { useTranslation } from "../helpers/useTranslation";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import styles from "./PasswordLoginForm.module.css";

export type LoginFormData = z.infer<typeof schema>;

interface PasswordLoginFormProps {
  className?: string;
}

export const PasswordLoginForm: React.FC<PasswordLoginFormProps> = ({
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
    },
    schema,
  });

  const handleSubmit = async (data: LoginFormData) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postLogin(data);
      onLogin(result.user);
      setTimeout(() => navigate("/"), 200);
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : t('login_form.login_failed')
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
    return (
      <ForgotPasswordForm
        className={className}
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className={`${styles.form} ${className || ""}`}
      >
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="email">
          <FormLabel>{t("login_form.email")}</FormLabel>
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

        <FormItem name="password">
          <FormLabel>{t("login_form.password")}</FormLabel>
          <FormControl>
            <div className={styles.passwordInputWrapper}>
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={isLoading}
                value={form.values.password}
                onChange={(e) =>
                  form.setValues((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
                className={styles.passwordInput}
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
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
              {t("login_form.logging_in")}
            </span>
          ) : (
            t("login_form.login")
          )}
        </Button>

        <div
          className={styles.forgotPassword}
          onClick={() => setShowForgotPassword(true)}
          role="button"
          tabIndex={0}
        >
          {t('login_form.forgot_password')}
        </div>
      </form>
    </Form>
  );
};
