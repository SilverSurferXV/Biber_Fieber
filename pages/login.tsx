import React, { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/Tabs';
import { PasswordLoginForm } from '../components/PasswordLoginForm';
import { PasswordRegisterForm } from '../components/PasswordRegisterForm';
import { useAuth } from '../helpers/useAuth';
import { useTranslation } from '../helpers/useTranslation';
import styles from './login.module.css';

export default function Login() {
  const { authState } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') === 'register-business' 
    ? 'register-business' 
    : searchParams.get('tab') === 'register' 
      ? 'register' 
      : 'login';

  const bibercodeParam = searchParams.get('bibercode');
  const registerDefaultValues = bibercodeParam ? { referralCode: bibercodeParam } : undefined;

  // Optionally navigate away if already authenticated, though the user requested the component handles logic,
  // the app logic typically directs logged in users away from the login page.
  useEffect(() => {
    if (authState.type === 'authenticated') {
      navigate('/');
    }
  }, [authState, navigate]);

  return (
        <div className={styles.container}>
            <div className={styles.card}>
        <Link to="/" className={styles.backLink}>
          <ArrowLeft size={18} />
          {t("login.back")}
        </Link>
        <div className={styles.logoWrapper}>
          <img 
            src="https://assets.floot.app/369c3501-fab4-4d1f-9c4f-7e589a5b18c1/1ce32e1f-d8cc-4c4c-8458-b1f929638cdc.png" 
            alt="Biber Fieber Logo" 
            className={styles.logo} 
          />
        </div>
        
        <Tabs defaultValue={defaultTab} className={styles.tabs}>
          <TabsList className={styles.tabsList}>
            <TabsTrigger value="login" className={styles.tabTrigger}>{t("login.login")}</TabsTrigger>
            <TabsTrigger value="register" className={styles.tabTrigger}>{t("login.register")}</TabsTrigger>
            <TabsTrigger value="register-business" className={styles.tabTrigger}>{t("login.reg_business")}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="login" className={styles.tabContent}>
                        <PasswordLoginForm />
          </TabsContent>
          
          <TabsContent value="register" className={styles.tabContent}>
            <PasswordRegisterForm defaultValues={registerDefaultValues} />
          </TabsContent>
          
          <TabsContent value="register-business" className={styles.tabContent}>
            <PasswordRegisterForm showCompanyName={true} defaultValues={registerDefaultValues} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}