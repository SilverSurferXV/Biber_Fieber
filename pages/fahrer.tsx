import React, { useState } from 'react';
import { Calendar, PackageX, Map, Truck, Lock, CheckCircle, Phone, ArrowLeft, Route, Share, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { toast } from 'sonner';
import { useAuth } from '../helpers/useAuth';
import { getClientPlatform } from '../helpers/getClientPlatform';
import { useRouteOptimization, LAGER_ALLING_ADDRESS } from '../helpers/useRouteOptimization';
import { DriverLayout } from '../components/DriverLayout';
import { DriverAuftraege } from '../components/DriverAuftraege';
import { DriverEarnings } from '../components/DriverEarnings';
import { Form, FormControl, FormItem, FormLabel, FormMessage, useForm } from '../components/Form';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Spinner } from '../components/Spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/Tabs';
import { postDriverLogin } from '../endpoints/auth/driver/login_POST.schema';
import { postDriverRegister } from '../endpoints/auth/driver/register_POST.schema';
import { DriverOrder } from '../endpoints/driver/orders_GET.schema';
import { useDriverOrders } from '../helpers/useDriverOrders';
import { useUpcomingDeliveries } from '../helpers/useUpcomingDeliveries';
import { useQueryClient } from '@tanstack/react-query';
import { DRIVER_EARNINGS_QUERY_KEY } from '../helpers/useDriverEarnings';
import { DRIVER_CREDIT_NOTES_KEY } from '../helpers/useDriverCreditNotes';
import { getDriverEarnings } from '../endpoints/driver/earnings_GET.schema';
import { getDriverCreditNotes } from '../endpoints/driver/credit-notes_GET.schema';
import styles from './fahrer.module.css';

const loginSchema = z.object({
  identifier: z.string().min(1, "E-Mail oder Mobilnummer ist erforderlich"),
  password: z.string().min(1, "Passwort ist erforderlich"),
});

function DriverLoginForm() {
  const { onLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const form = useForm({
    defaultValues: {
      identifier: "",
      password: "",
    },
    schema: loginSchema,
  });

  const handleSubmit = async (data: z.infer<typeof loginSchema>) => {
    setError(null);
    setIsLoading(true);

   try {
      const result = await postDriverLogin({ ...data, clientPlatform: getClientPlatform() });
      onLogin(result.user);
    } catch (err) {
      console.error("Login error:", err);
      setError(
        err instanceof Error ? err.message : "Anmeldung fehlgeschlagen. Bitte versuche es erneut."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.loginForm}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <FormItem name="identifier">
          <FormLabel>E-Mail / Mobilnummer</FormLabel>
          <FormControl>
            <Input
              placeholder="fahrer@biberfieber.de oder 0151..."
              autoComplete="username"
              disabled={isLoading}
              value={form.values.identifier}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, identifier: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Passwort</FormLabel>
          <FormControl>
            <Input
              type="password"
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
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitBtn}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              Anmelden...
            </>
          ) : (
            "Anmelden"
          )}
        </Button>
      </form>
    </Form>
  );
}

const registerSchema = z
  .object({
    firstName: z.string().min(1, "Vorname ist erforderlich"),
    lastName: z.string().min(1, "Nachname ist erforderlich"),
    email: z.string().email("Gültige E-Mail ist erforderlich"),
    mobileNumber: z.string().min(1, "Mobilnummer ist erforderlich"),
    password: z.string().min(8, "Passwort muss mindestens 8 Zeichen lang sein"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

function DriverRegisterForm() {
  const { onLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      mobileNumber: "",
      password: "",
      confirmPassword: "",
    },
    schema: registerSchema,
  });

  const handleSubmit = async (data: z.infer<typeof registerSchema>) => {
    setError(null);
    setIsLoading(true);

    try {
      const result = await postDriverRegister({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        mobileNumber: data.mobileNumber,
        password: data.password,
      });
      onLogin(result.user);
    } catch (err) {
      console.error("Register error:", err);
      setError(
        err instanceof Error ? err.message : "Registrierung fehlgeschlagen. Bitte versuche es erneut."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className={styles.loginForm}>
        {error && <div className={styles.errorMessage}>{error}</div>}

        <div className={styles.formRow}>
          <FormItem name="firstName" className={styles.formCol}>
            <FormLabel>Vorname</FormLabel>
            <FormControl>
              <Input
                placeholder="Max"
                disabled={isLoading}
                value={form.values.firstName}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, firstName: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="lastName" className={styles.formCol}>
            <FormLabel>Nachname</FormLabel>
            <FormControl>
              <Input
                placeholder="Mustermann"
                disabled={isLoading}
                value={form.values.lastName}
                onChange={(e) =>
                  form.setValues((prev) => ({ ...prev, lastName: e.target.value }))
                }
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </div>

        <FormItem name="email">
          <FormLabel>E-Mail</FormLabel>
          <FormControl>
            <Input
              type="email"
              placeholder="fahrer@biberfieber.de"
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

        <FormItem name="mobileNumber">
          <FormLabel>Mobilnummer</FormLabel>
          <FormControl>
            <Input
              type="tel"
              placeholder="+49 151 12345678"
              autoComplete="tel"
              disabled={isLoading}
              value={form.values.mobileNumber}
              onChange={(e) =>
                form.setValues((prev) => ({ ...prev, mobileNumber: e.target.value }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="password">
          <FormLabel>Passwort</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="Min. 8 Zeichen"
              autoComplete="new-password"
              disabled={isLoading}
              value={form.values.password}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <FormItem name="confirmPassword">
          <FormLabel>Passwort bestätigen</FormLabel>
          <FormControl>
            <Input
              type="password"
              placeholder="Passwort wiederholen"
              autoComplete="new-password"
              disabled={isLoading}
              value={form.values.confirmPassword}
              onChange={(e) =>
                form.setValues((prev) => ({
                  ...prev,
                  confirmPassword: e.target.value,
                }))
              }
            />
          </FormControl>
          <FormMessage />
        </FormItem>

        <Button
          type="submit"
          disabled={isLoading}
          className={styles.submitBtn}
        >
          {isLoading ? (
            <>
              <Spinner size="sm" />
              Registrieren...
            </>
          ) : (
            "Registrieren"
          )}
        </Button>
      </form>
    </Form>
  );
}

function DriverAuth() {
  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginContent}>
        <div className={styles.loginCard}>
          <div className={styles.loginHeader}>
          <div className={styles.loginIconWrapper}>
            <Truck size={32} className={styles.loginIcon} />
          </div>
          <h1 className={styles.loginTitle}>Fahrer-Bereich</h1>
          <p className={styles.loginSubtitle}>Bitte melde dich an oder registriere dich.</p>
        </div>

        <Tabs defaultValue="login" className={styles.tabsContainer}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="login" className={styles.tabsTriggerOverride}>
              Anmelden
            </TabsTrigger>
            <TabsTrigger value="register" className={styles.tabsTriggerOverride}>
              Registrieren
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="login">
            <DriverLoginForm />
          </TabsContent>
          
          <TabsContent value="register">
            <DriverRegisterForm />
          </TabsContent>
        </Tabs>
      </div>
        <Link to="/shop" className={styles.backLink}>
          <ArrowLeft size={16} />
          Zurück zum Shop
        </Link>
      </div>
    </div>
  );
}

export default function FahrerDashboard() {
  const { authState, logout } = useAuth();
  const { data: driverOrdersData, isFetching: isDriverOrdersFetching } = useDriverOrders();
  const { data: upcomingData, isFetching: isUpcomingFetching } = useUpcomingDeliveries();
  const queryClient = useQueryClient();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'auftraege' | 'dispo' | 'verdienst'>('dashboard');
  const logoutAttemptedRef = React.useRef(false);

    React.useEffect(() => {
    if (
      authState.type === 'authenticated' &&
      authState.user.role !== 'driver' &&
      !logoutAttemptedRef.current
    ) {
      logoutAttemptedRef.current = true;
      setIsLoggingOut(true);
      logout().finally(() => {
        setIsLoggingOut(false);
      });
    }
  }, [authState, logout]);

  const upcomingGroups = React.useMemo(() => {
    if (!upcomingData?.deliveries) return [];
    const groups: Record<string, typeof upcomingData.deliveries> = {};
    for (const d of upcomingData.deliveries) {
      if (!groups[d.date]) groups[d.date] = [];
      groups[d.date].push(d);
    }
    return Object.keys(groups)
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .map((date) => ({
        date,
      items: groups[date],
      }));
  }, [upcomingData]);

  React.useEffect(() => {
    if (driverOrdersData?.assignedPostcodes && driverOrdersData.assignedPostcodes.length > 0) {
      queryClient.prefetchQuery({
        queryKey: DRIVER_EARNINGS_QUERY_KEY,
        queryFn: () => getDriverEarnings(),
        staleTime: 8 * 60 * 1000,
      });
      queryClient.prefetchQuery({
        queryKey: DRIVER_CREDIT_NOTES_KEY,
        queryFn: () => getDriverCreditNotes(),
        staleTime: 8 * 60 * 1000,
      });
    }
  }, [driverOrdersData?.assignedPostcodes, queryClient]);

  React.useEffect(() => {
    if (driverOrdersData?.orders && driverOrdersData.orders.length > 0) {
      const urls = new Set<string>();
      for (const order of driverOrdersData.orders) {
        if (order.customer.dropoffPhotoUrl) {
          urls.add(order.customer.dropoffPhotoUrl);
        }
      }
      for (const url of urls) {
        const img = new Image();
        img.src = url;
      }
    }
  }, [driverOrdersData?.orders]);

  if (
    authState.type === 'loading' ||
    isLoggingOut ||
    (authState.type === 'authenticated' && authState.user.role !== 'driver')
  ) {
    return (
      <div className={styles.loadingWrapper}>
        <Spinner size="lg" />
      </div>
    );
  }

  if (authState.type === 'unauthenticated') {
    return <DriverAuth />;
  }

  const { user } = authState;

    const today = new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(new Date());

  return (
    <DriverLayout activeTab={activeTab} onTabChange={setActiveTab}>
      <div className={styles.container}>
        <header className={styles.headerSection}>
          <div>
            <h1 className={styles.title}>Fahrer-Dashboard</h1>
            <p className={styles.subtitle}>Guten Morgen! Hier ist deine Übersicht für heute.</p>
            <div className={styles.driverInfo}>
              <p><strong>Name:</strong> {[user.firstName, user.lastName].filter(Boolean).join(' ') || 'Unbekannt'}</p>
              <p><strong>E-Mail:</strong> {user.email}</p>
              {user.mobileNumber && <p><strong>Telefon:</strong> {user.mobileNumber}</p>}
            </div>
          </div>
          <div className={styles.dateBadge}>
            <Calendar size={18} />
            {today}
          </div>
        </header>

        {activeTab === 'dashboard' ? (
          <div className={styles.grid}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Zugewiesene Lieferungen</h2>
              </div>
              <div className={styles.cardContent}>
                {isDriverOrdersFetching ? (
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <Spinner size="md" />
                  </div>
                ) : driverOrdersData?.assignedPostcodes?.length ? (
                  <div className={styles.plzList}>
                    {driverOrdersData.assignedPostcodes.map((postcode) => {
                      const count = driverOrdersData.orders.filter(
                        (o) => o.customer.postcode === postcode
                      ).length;
                      return (
                        <div key={postcode} className={styles.plzItem}>
                          <div className={styles.plzNumber}>{postcode}</div>
                          <div className={styles.plzCount}>
                            {count} {count === 1 ? 'Bestellung' : 'Bestellungen'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.iconWrapper}>
                      <Map size={48} className={styles.emptyIcon} />
                    </div>
                    <h3 className={styles.emptyTitle}>Keine PLZ zugewiesen</h3>
                    <p className={styles.emptyText}>Der Admin hat dir noch keine Liefergebiete für heute zugewiesen.</p>
                  </div>
                )}
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Anstehende Lieferungen</h2>
              </div>
              <div className={styles.cardContent}>
                {isUpcomingFetching ? (
                  <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
                    <Spinner size="md" />
                  </div>
                ) : upcomingGroups.length > 0 ? (
                  <div className={styles.upcomingList}>
                    {upcomingGroups.map((group) => (
                      <div key={group.date} className={styles.upcomingDateGroup}>
                        <div className={styles.upcomingDateHeader}>
                          {new Intl.DateTimeFormat('de-DE', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }).format(new Date(group.date))}
                        </div>
                        {group.items.map((item, idx) => (
                          <div key={idx} className={styles.upcomingItem}>
                            <div className={styles.upcomingPlz}>
                              {item.postcode} {item.cityName || ''}
                            </div>
                            <div className={styles.upcomingStops}>
                              {item.stopCount} {item.stopCount === 1 ? 'Stop' : 'Stops'}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <div className={styles.iconWrapper}>
                      <Calendar size={48} className={styles.emptyIcon} />
                    </div>
                    <h3 className={styles.emptyTitle}>Keine anstehenden Lieferungen</h3>
                    <p className={styles.emptyText}>Es gibt momentan keine geplanten Lieferungen für die Zukunft.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : activeTab === 'auftraege' ? (
          <DriverAuftraege />
        ) : activeTab === 'dispo' ? (
          <div className={styles.dispoContainer}>
            <section className={styles.card}>
              <div className={styles.cardHeader}>
                <h2 className={styles.cardTitle}>Disposition</h2>
              </div>
              <div className={styles.cardContent}>
                <div className={styles.dispoButtons}>
                  <button 
                    className={`${styles.dispoBtn} ${styles.dispoBtnWhatsapp}`} 
                    onClick={() => window.open('https://wa.me/491605702534', '_blank')}
                  >
                    <MessageCircle className={styles.dispoBtnIcon} size={32} />
                    <div className={styles.dispoBtnText}>
                      <span className={styles.dispoBtnLabel}>WhatsApp Nachricht</span>
                      <span className={styles.dispoBtnNumber}>+49 160 570 2534</span>
                    </div>
                  </button>
                  <button 
                    className={`${styles.dispoBtn} ${styles.dispoBtnCall}`} 
                    onClick={() => window.open('tel:+491605702534', '_self')}
                  >
                    <Phone className={styles.dispoBtnIcon} size={32} />
                    <div className={styles.dispoBtnText}>
                      <span className={styles.dispoBtnLabel}>Anrufen</span>
                      <span className={styles.dispoBtnNumber}>+49 160 570 2534</span>
                    </div>
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <DriverEarnings />
        )}
      </div>
    </DriverLayout>
  );
}