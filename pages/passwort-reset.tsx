import React, { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { z } from 'zod';
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from '../components/Form';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { postResetPassword } from '../endpoints/auth/reset-password_POST.schema';
import { useTranslation } from '../helpers/useTranslation';
import styles from './passwort-reset.module.css';

export default function PasswortReset() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();

  const resetSchema = React.useMemo(() => z.object({
    password: z.string().min(8, t("register.password_hint") || "Passwort muss mindestens 8 Zeichen lang sein"),
    confirmPassword: z.string()
  }).refine((data) => data.password === data.confirmPassword, {
    message: t("reset_password.password_mismatch") || "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  }), [t]);
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
    schema: resetSchema,
  });

  if (!token) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('reset_password.invalid_link')}</h1>
          <p className={styles.description}>{t('reset_password.invalid_description')}</p>
          <Button asChild className={styles.fullWidthButton}>
            <Link to="/login">{t('reset_password.back_to_login')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: z.infer<typeof resetSchema>) => {
    setError(null);
    setIsLoading(true);
    try {
      await postResetPassword({ token, password: data.password });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("notifications.error") || 'Ein Fehler ist aufgetreten');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>{t('reset_password.success_title')}</h1>
          <p className={styles.description}>{t('reset_password.success_description')}</p>
          <Button asChild className={styles.fullWidthButton}>
            <Link to="/login">{t('reset_password.to_login')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>{t('reset_password.title')}</h1>
        <p className={styles.description}>{t('reset_password.description')}</p>
        
        {error && <div className={styles.errorMessage}>{error}</div>}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.form}>
            <FormItem name="password">
              <FormLabel>{t('reset_password.new_password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  value={form.values.password}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, password: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="confirmPassword">
              <FormLabel>{t('reset_password.confirm_password')}</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="••••••••"
                  disabled={isLoading}
                  value={form.values.confirmPassword}
                  onChange={(e) => form.setValues((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <Button type="submit" disabled={isLoading} className={styles.fullWidthButton}>
              {isLoading ? t('reset_password.saving') : t('reset_password.change_password')}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}