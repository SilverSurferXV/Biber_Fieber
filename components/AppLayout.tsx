import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Menu, X, User, LogOut } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import { useCart } from '../helpers/useCart';
import { useProfile, useUpdateProfile } from '../helpers/useCustomerApi';
import { useTranslation, SupportedLanguage } from '../helpers/useTranslation';
import { useQueryClient } from '@tanstack/react-query';
import { getCategoriesList } from '../endpoints/categories/list_GET.schema';
import { getProductsList } from '../endpoints/products/list_GET.schema';
import { getSettings } from '../endpoints/settings_GET.schema';
import { useSettings } from '../helpers/useShopApi';
import { Button } from './Button';
import { Badge } from './Badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from './DropdownMenu';
import { DeliveryFeedbackDialog } from './DeliveryFeedbackDialog';
import { usePendingNotifications, useDismissNotification } from '../helpers/useNotifications';
import { useConnectionQuality } from '../helpers/useConnectionQuality';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './Dialog';
import styles from './AppLayout.module.css';

const UserAvatarIcon = () => {
  const { data: profile } = useProfile();
  if (profile?.avatarUrl) {
    return <img src={profile.avatarUrl} alt="User Avatar" className={styles.userAvatar} />;
  }
  return <User size={20} />;
};

const PointsBadge = () => {
  const { data: profile } = useProfile();
  const { t } = useTranslation();
  if (!profile) return null;
  
  return (
    <Link to="/account?tab=guthaben" className={styles.pointsBadge}>
      💰 {Number(profile.pointsBalance || 0).toFixed(2)} {t('nav.punkte')}
    </Link>
  );
};

const ZoneNotificationPopup = () => {
  const { data: notifications } = usePendingNotifications();
  const dismissMutation = useDismissNotification();
  const [isOpen, setIsOpen] = useState(true);
  const { t } = useTranslation();

  const notification = notifications?.[0];

  useEffect(() => {
    if (notification) {
      setIsOpen(true);
    }
  }, [notification]);

  const handleDismiss = async () => {
    if (!notification) return;
    setIsOpen(false);
    try {
      await dismissMutation.mutateAsync(notification.id);
    } catch (error) {
      console.error(error);
      setIsOpen(true);
    }
  };

  if (!notification) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleDismiss();
    }}>
      <DialogContent className={styles.notificationDialog}>
        <div className={styles.notificationInner}>
          <div className={styles.partyEmoji}>🎉</div>
          <DialogHeader>
            <DialogTitle className={styles.notificationTitle}>{notification.title}</DialogTitle>
            <DialogDescription className={styles.notificationMessage}>
              {notification.message}
            </DialogDescription>
          </DialogHeader>
          <Button onClick={handleDismiss} disabled={dismissMutation.isPending} className={styles.notificationButton}>
            {t('layout.understood')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const LANGUAGE_OPTIONS = [
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
  { code: 'tr', flag: '🇹🇷', name: 'Türkçe' },
] as const;

export const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { authState, logout } = useAuth();
  const { getItemCount } = useCart();
  const { t, lang, setLang } = useTranslation();
  const { mutate: updateProfile } = useUpdateProfile();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const logoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cartCount = getItemCount();
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { quality, reduceAnimations } = useConnectionQuality();

  const filteredLanguages = LANGUAGE_OPTIONS.filter(l => 
    l.code === 'de' || !settings?.enabledLanguages || (settings.enabledLanguages as any)[l.code] !== false
  );

  useEffect(() => {
    queryClient.prefetchQuery({
      queryKey: ["shop", "settings"],
      queryFn: () => getSettings({}),
      staleTime: 5 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ["shop", "categories"],
      queryFn: () => getCategoriesList({}),
      staleTime: 5 * 60 * 1000,
    });
    queryClient.prefetchQuery({
      queryKey: ["shop", "products", undefined],
      queryFn: () => getProductsList({}),
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  useEffect(() => {
    if (authState.type === 'authenticated' && authState.user.role === 'driver') {
      logout().catch(console.error);
    }
  }, [authState, logout]);

  const handlePointerDown = () => {
    if (logoTimerRef.current) clearTimeout(logoTimerRef.current);
    logoTimerRef.current = setTimeout(() => {
      navigate('/fahrer');
    }, 3000);
  };

  const clearTimer = () => {
    if (logoTimerRef.current) {
      clearTimeout(logoTimerRef.current);
      logoTimerRef.current = null;
    }
  };

  const handleLanguageChange = (code: SupportedLanguage) => {
    setLang(code);
    if (authState.type === 'authenticated') {
      updateProfile({ languagePreference: code } as any);
    }
  };

  const handleLogoClick = (e: React.MouseEvent) => {
    clickCountRef.current += 1;

    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    if (clickCountRef.current >= 3) {
      e.preventDefault();
      navigate('/fahrer');
      clickCountRef.current = 0;
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 800);
    }
  };

  return (
    <div 
      className={`${styles.container} ${reduceAnimations ? styles.reducedMotion : ''}`}
      data-connection={quality}
    >
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.logoLink}>
            <img 
              src="https://assets.floot.app/369c3501-fab4-4d1f-9c4f-7e589a5b18c1/1ce32e1f-d8cc-4c4c-8458-b1f929638cdc.png" 
              alt="Biber Fieber" 
              className={`${styles.logo} ${quality === 'slow' ? styles.logoSmall : ''}`} 
              onPointerDown={handlePointerDown}
              onPointerUp={clearTimer}
              onPointerLeave={clearTimer}
              onPointerCancel={clearTimer}
              onClick={handleLogoClick}
            />
          </Link>
          
          <nav className={styles.desktopNav}>
            <Link to="/" className={`${styles.navLink} ${location.pathname === '/' ? styles.active : ''}`}>{t('nav.home')}</Link>
                        <Link to="/shop" className={`${styles.navLink} ${styles.shopLink} ${location.pathname === '/shop' ? styles.active : ''}`}>{t('nav.shop')}</Link>
            {authState.type === 'authenticated' && (
              <Link to="/account?tab=guthaben" className={`${styles.navLink} ${location.pathname === '/account' && location.search.includes('tab=guthaben') ? styles.active : ''}`}>{t('nav.guthaben')}</Link>
            )}
            <Link to="/liefergebiet" className={`${styles.navLink} ${location.pathname === '/liefergebiet' ? styles.active : ''}`}>{t('nav.liefergebiet')}</Link>
            <Link to="/sonderbereich" className={`${styles.navLink} ${location.pathname === '/sonderbereich' ? styles.active : ''}`}>{t('nav.sonderbereich')}</Link>
            <Link to="/about" className={`${styles.navLink} ${location.pathname === '/about' ? styles.active : ''}`}>{t('nav.about')}</Link>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={styles.langTrigger} title={t('nav.language') || 'Language'}>
                  {LANGUAGE_OPTIONS.find(l => l.code === lang)?.flag || '🇩🇪'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {filteredLanguages.map(l => (
                  <DropdownMenuItem 
                    key={l.code} 
                    onClick={() => handleLanguageChange(l.code)}
                    style={lang === l.code ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : {}}
                  >
                    <span style={{ marginRight: '8px' }}>{l.flag}</span>
                    {l.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className={styles.actions}>
            {authState.type === 'authenticated' && <div className={styles.desktopPoints}><PointsBadge /></div>}
            {authState.type === 'authenticated' ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className={styles.userBtn}>
                    <UserAvatarIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <Link to="/account">{t('nav.account')}</Link>
                  </DropdownMenuItem>
                  {authState.user.role === 'admin' && (
                    <DropdownMenuItem asChild>
                      <Link to="/admin">{t('nav.admin')}</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logout()}>
                    <LogOut size={16} style={{ marginRight: '8px' }} />
                    {t('nav.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm" className={styles.loginBtn}>
                <Link to="/login">{t('nav.login_register')}</Link>
              </Button>
            )}

            <Button asChild variant="primary" size="icon" className={styles.cartBtn}>
              <Link to="/checkout">
                <ShoppingCart size={12} />
                {cartCount > 0 && <Badge className={styles.cartBadge} variant="secondary">{cartCount}</Badge>}
              </Link>
            </Button>

            {authState.type === 'authenticated' && (
              <Button variant="ghost" size="icon" className={styles.mobileMenuBtn} onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={24} /> : <Menu size={24} />}
              </Button>
            )}
          </div>
        </div>
        {authState.type !== 'authenticated' && (
          <div className={styles.mobileAuthButtons}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={styles.langTrigger} style={{ marginRight: 'auto' }}>
                  {LANGUAGE_OPTIONS.find(l => l.code === lang)?.flag || '🇩🇪'}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {filteredLanguages.map(l => (
                  <DropdownMenuItem 
                    key={l.code} 
                    onClick={() => handleLanguageChange(l.code)}
                    style={lang === l.code ? { backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' } : {}}
                  >
                    <span style={{ marginRight: '8px' }}>{l.flag}</span>
                    {l.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild variant="outline" size="sm">
              <Link to="/login">{t('nav.login')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/login?tab=register">{t('nav.register')}</Link>
            </Button>
          </div>
        )}
        {menuOpen && authState.type === 'authenticated' && (
          <div className={styles.mobileNav}>
            <Link to="/account" onClick={() => setMenuOpen(false)}>{t('nav.account')}</Link>
            {authState.user.role === 'admin' && <Link to="/admin" onClick={() => setMenuOpen(false)}>{t('nav.admin')}</Link>}

            <button className={styles.mobileLogoutBtn} onClick={() => { logout(); setMenuOpen(false); }}>
              <LogOut size={18} /> {t('nav.logout')}
            </button>
          </div>
        )}
      </header>
      <main className={styles.main}>
        {children}
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>&copy; {new Date().getFullYear()} Biber Fieber. {t('footer.rights')}</p>
        </div>
      </footer>
      {authState.type === "authenticated" && <ZoneNotificationPopup />}
      <DeliveryFeedbackDialog />
    </div>
  );
};