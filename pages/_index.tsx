import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sun, Cloud, CloudRain, Snowflake, CloudLightning, MessageCircle, Instagram, Facebook, Newspaper, CalendarDays } from 'lucide-react';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { useFfbNews } from '../helpers/useFfbNews';
import { useTranslation } from '../helpers/useTranslation';

const WhatsAppLogo = ({ size = 64, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
  </svg>
);

const TikTokIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2-1.94 2.89 2.89 0 0 1 2.86-2.89c.17 0 .34.02.5.06V7.39a6.3 6.3 0 0 0-.5-.02 6.34 6.34 0 0 0-6.32 6.34A6.34 6.34 0 0 0 9.77 20a6.34 6.34 0 0 0 6.32-6.34V8.58a8.3 8.3 0 0 0 5.43 2.01V7.12a4.9 4.9 0 0 1-1.93-.43z"/>
  </svg>
);

const YouTubeIcon = ({ size = 24, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.546 12 3.546 12 3.546s-7.505 0-9.377.504A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.504 9.376.504 9.376.504s7.505 0 9.377-.504a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);
import { toast } from 'sonner';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from '../components/Form';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';
import { useSettings } from '../helpers/useShopApi';
import { useAuth } from '../helpers/useAuth';
import { useContactForm } from '../helpers/useContactForm';
import { schema as contactSchema } from '../endpoints/contact/send_POST.schema';
import { getUpcomingBavarianHolidays } from '../helpers/bavarianHolidays';
import { useConnectionQuality } from '../helpers/useConnectionQuality';
import styles from './_index.module.css';

const WeatherWidget = () => {
  const { t, lang } = useTranslation();
  const { data: settings } = useSettings();
  const { reducedDataMode } = useConnectionQuality();
  const lat = settings?.shopLatitude || 52.52;
  const lng = settings?.shopLongitude || 13.41;

  const { data: weather } = useQuery({
    queryKey: ['weather', lat, lng],
    queryFn: async () => {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
      if (!res.ok) throw new Error('Weather fetch failed');
      return res.json();
    },
    enabled: !!lat && !!lng && !reducedDataMode
  });

  if (!reducedDataMode && !weather?.current_weather) return null;
  
  const getIcon = (code: number) => {
    if ([0].includes(code)) return <Sun size={32} className={styles.weatherIcon} />;
    if ([1,2,3,45,48].includes(code)) return <Cloud size={32} className={styles.weatherIcon} />;
    if ([51,53,55,61,63,65].includes(code)) return <CloudRain size={32} className={styles.weatherIcon} />;
    if ([71,73,75].includes(code)) return <Snowflake size={32} className={styles.weatherIcon} />;
    if ([95,96,99].includes(code)) return <CloudLightning size={32} className={styles.weatherIcon} />;
    return <Cloud size={32} className={styles.weatherIcon} />;
  };

  const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-US', es: 'es-ES', it: 'it-IT', tr: 'tr-TR' };
  const locale = localeMap[lang] || 'de-DE';
  const dateStr = new Date().toLocaleDateString(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const holidays = getUpcomingBavarianHolidays(5);

  return (
    <div className={styles.weatherWidget}>
      <div className={styles.weatherTop}>
        {reducedDataMode ? (
          <p className={styles.connectionWarning}>Wetter nicht verfügbar bei langsamer Verbindung</p>
        ) : weather?.current_weather ? (
          <>
            {getIcon(weather.current_weather.weathercode)}
            <div className={styles.weatherInfo}>
              <span className={styles.temp}>{weather.current_weather.temperature}°C</span>
              <span className={styles.date}>{dateStr}</span>
            </div>
          </>
        ) : null}
      </div>
      <div className={styles.weatherSeparator} />
      <div className={styles.holidaysCompact}>
        <div className={styles.holidaysTitle}>
          <CalendarDays size={16} />
          <span>{t("home.notice")}</span>
        </div>
        <div className={styles.holidayListCompact}>
          {holidays.map((h, i) => (
            <div key={i} className={styles.holidayItemCompact}>
              <span>{h.name}</span>
              <span>
                {h.date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const FfbNewsWidget = () => {
  const { data: news, isFetching, error } = useFfbNews();
  const { t } = useTranslation();

  return (
    <section className={styles.newsSection}>
      <div className={styles.newsHeader}>
        <Newspaper size={24} className={styles.newsIcon} />
        <h3>{t("home.local_news")}</h3>
      </div>
      <div className={styles.newsList}>
        {isFetching ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className={styles.newsItem}>
              <Skeleton style={{ width: '80%', height: '1.25rem' }} />
              <Skeleton style={{ width: '100px', height: '0.875rem', marginTop: 'var(--spacing-1)' }} />
            </div>
          ))
        ) : error ? (
          <p className={styles.newsError}>{t("home.news_error")}</p>
        ) : news && news.length > 0 ? (
          news.slice(0, 5).map((item, idx) => {
            const date = new Date(item.pubDate);
            const formattedDate = date.toLocaleDateString('de-DE', {
              weekday: 'short',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
            return (
              <a
                key={idx}
                href={item.link}
                target="_blank"
                rel="noreferrer"
                className={styles.newsItemLink}
              >
                <span className={styles.newsTitle}>{item.title}</span>
                <span className={styles.newsDate}>{formattedDate}</span>
              </a>
            );
          })
        ) : (
          <p className={styles.newsEmpty}>{t("home.news_empty")}</p>
        )}
      </div>
    </section>
  );
};

const ContactSection = () => {
  const { t } = useTranslation();
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      telefon: "",
      betreff: "",
      nachricht: "",
    },
    schema: contactSchema,
  });

  const { mutate: sendContact, isPending } = useContactForm();

  const onSubmit = (values: any) => {
    sendContact(values, {
      onSuccess: () => {
        toast.success(t("home.send_success"));
        form.setValues({
          name: "",
          email: "",
          telefon: "",
          betreff: "",
          nachricht: "",
        });
      },
      onError: (err) => {
        toast.error(err instanceof Error ? err.message : t("home.send_error"));
      }
    });
  };

  return (
    <section className={styles.contactSection}>
      <h3>{t("home.share_message")}</h3>
      <div className={styles.contactFormWrapper}>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.contactForm}>
            <FormItem name="name">
              <FormLabel>{t("home.name")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("home.your_name")}
                  value={form.values.name}
                  onChange={(e) => form.setValues(prev => ({ ...prev, name: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            
            <FormItem name="email">
              <FormLabel>{t("login_form.email")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("home.your_email")}
                  value={form.values.email}
                  onChange={(e) => form.setValues(prev => ({ ...prev, email: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="telefon">
              <FormLabel>{t("home.phone_optional")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("home.your_phone")}
                  value={form.values.telefon ?? ""}
                  onChange={(e) => form.setValues(prev => ({ ...prev, telefon: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="betreff">
              <FormLabel>{t("home.subject")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("home.your_subject")}
                  value={form.values.betreff ?? ""}
                  onChange={(e) => form.setValues(prev => ({ ...prev, betreff: e.target.value }))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="nachricht">
              <FormLabel>{t("home.message")}</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={t("home.your_message")}
                  value={form.values.nachricht}
                  onChange={(e) => form.setValues(prev => ({ ...prev, nachricht: e.target.value }))}
                  rows={5}
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <Button type="submit" size="lg" className={styles.contactSubmitBtn} disabled={isPending}>
              {isPending ? t("home.sending") : t("home.send")}
            </Button>
          </form>
        </Form>
      </div>
    </section>
  );
};

export default function Home() {
  const { t, lang } = useTranslation();
  const { authState } = useAuth();
  const { data: settings } = useSettings();
  const { quality, reduceAnimations, reducedDataMode } = useConnectionQuality();
  const [countdownData, setCountdownData] = useState<{ timeLeft: number; deliveryDayName: string } | null>(null);

  const localeMap: Record<string, string> = { de: 'de-DE', en: 'en-US', es: 'es-ES', it: 'it-IT', tr: 'tr-TR' };

  useEffect(() => {
    const calc = () => {
      if (!settings?.deliveryDays) return null;
      
      const now = new Date();
      const berlinStr = now.toLocaleString("en-US", { timeZone: "Europe/Berlin", hour12: false });
      const berlinDate = new Date(berlinStr);
      
      const cutoffStr = settings.orderCutoffTime || "16:00";
      const [cutoffHour, cutoffMin] = cutoffStr.split(':').map(Number);
      
      const daysArray = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
      const deliveryDaysObj = settings.deliveryDays as Record<string, boolean>;
      
      let found = false;
      let targetCutoff = new Date(berlinDate);
      let deliveryDate = new Date(berlinDate);
      
      for (let i = 1; i <= 14; i++) {
        const testDate = new Date(berlinDate);
        testDate.setDate(berlinDate.getDate() + i);
        
        const dayName = daysArray[testDate.getDay()];
        if (deliveryDaysObj[dayName]) {
          const cutoff = new Date(testDate);
          cutoff.setDate(testDate.getDate() - 1);
          cutoff.setHours(cutoffHour, cutoffMin, 0, 0);

          if (berlinDate.getTime() < cutoff.getTime()) {
            found = true;
            targetCutoff = cutoff;
            deliveryDate = testDate;
            break;
          }
        }
      }

      if (!found) {
        return {
          timeLeft: -1,
          deliveryDayName: ""
        };
      }

      const currentLocale = localeMap[lang] || 'de-DE';
      const deliveryDayName = new Intl.DateTimeFormat(currentLocale, { weekday: 'long' }).format(deliveryDate);

      return {
        timeLeft: targetCutoff.getTime() - berlinDate.getTime(),
        deliveryDayName
      };
    };

    setCountdownData(calc());
    const int = setInterval(() => setCountdownData(calc()), 1000);
    return () => clearInterval(int);
  }, [settings?.orderCutoffTime, settings?.deliveryDays, lang]);

  const whatsappUrl = settings?.whatsappNumber 
    ? `https://wa.me/${settings.whatsappNumber.replace(/\+/g, '')}`
    : '#';

  const locale = localeMap[lang] || 'de-DE';

  return (
    <div className={styles.container}>
      <section className={`${styles.hero} ${quality === 'slow' ? styles.heroReduced : ''}`}>
        
        <h1 className={styles.heroTitle}>{t("home.title")}</h1>
        <p className={styles.heroSubtitle}>{t("home.subtitle")}</p>
        
        <div className={styles.countdownBox}>
          <div className={styles.timeBox}>
            <span className={styles.timeLabel}>
              {countdownData ? (countdownData.timeLeft < 0 ? t("home.no_delivery_days") || "Keine Lieferung konfiguriert" : t("home.cutoff_for", { day: countdownData.deliveryDayName })) : t("home.time_left")}
            </span>
            <span className={styles.timeValue}>
              {countdownData !== null ? (
                countdownData.timeLeft < 0 ? (
                  "--:--:--"
                ) : (
                  `${Math.floor(countdownData.timeLeft / 3600000)}:${(Math.floor(countdownData.timeLeft / 60000) % 60).toString().padStart(2, '0')}:${(Math.floor(countdownData.timeLeft / 1000) % 60).toString().padStart(2, '0')}`
                )
              ) : (
                <Skeleton style={{ width: '150px', height: '2.5rem', display: 'inline-block' }} />
              )}
            </span>
          </div>
        </div>

        <Button asChild size="lg" className={styles.ctaButton}>
          <Link to="/shop">{t("home.to_shop")}</Link>
        </Button>
      </section>

      {settings?.whatsappNumber && (
        <div className={styles.supportSection}>
          <a href={whatsappUrl} target="_blank" rel="noreferrer" className={styles.supportLink}>
            <WhatsAppLogo />
            <span className={styles.supportText}>{t("home.support")}</span>
          </a>
        </div>
      )}

      <section className={styles.widgetsSection}>
        <WeatherWidget />

        {authState.type === 'authenticated' ? (
          <div className={styles.pointsWidget}>
            <span className={styles.pointsLabel}>{t("home.your_balance")}</span>
            <span className={styles.pointsValue}>{Number(authState.user.pointsBalance || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t("nav.punkte")}</span>
            <Button asChild variant="outline" size="sm" className={styles.topupBtn}>
              <Link to="/account?tab=guthaben">{t("home.topup")}</Link>
            </Button>
          </div>
        ) : (
          <div className={styles.pointsWidget}>
            <span className={styles.pointsLabel}>{t("home.collect_save")}</span>
            <div className={styles.pointsActions}>
              <Button asChild variant="outline" size="sm" className={styles.topupBtn}>
                <Link to="/login?tab=register">{t("home.register_now")}</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className={styles.loginBtn}>
                <Link to="/login">{t("nav.login")}</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      <section className={styles.socialSection}>
        <h3>{t("home.follow_us")}</h3>
        <div className={styles.socialLinks}>
          
          {settings?.instagramUrl && (
            <a href={settings.instagramUrl} target="_blank" rel="noreferrer" className={`${styles.socialIcon} ${styles.instagram}`}>
              <Instagram size={24} />
            </a>
          )}
          {settings?.facebookUrl && (
            <a href={settings.facebookUrl} target="_blank" rel="noreferrer" className={`${styles.socialIcon} ${styles.facebook}`}>
              <Facebook size={24} />
            </a>
          )}
          {settings?.tiktokUrl && (
            <a href={settings.tiktokUrl} target="_blank" rel="noreferrer" className={`${styles.socialIcon} ${styles.tiktok}`}>
              <TikTokIcon size={24} />
            </a>
          )}
          {settings?.youtubeUrl && (
            <a href={settings.youtubeUrl} target="_blank" rel="noreferrer" className={`${styles.socialIcon} ${styles.youtube}`}>
              <YouTubeIcon size={24} />
            </a>
          )}
        </div>
      </section>

      <ContactSection />

            {/* <FfbNewsWidget /> — Lokale News vorübergehend deaktiviert */}
    </div>
  );
}