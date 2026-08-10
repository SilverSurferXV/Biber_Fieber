import React from 'react';
import { Link } from 'react-router-dom';
import { LogOut, ArrowLeft, Truck, LayoutDashboard, Coins, Phone } from 'lucide-react';
import { useAuth } from '../helpers/useAuth';
import styles from './DriverLayout.module.css';

export const DriverLayout = ({ 
  children,
  activeTab = 'dashboard',
  onTabChange 
}: { 
  children: React.ReactNode;
  activeTab?: 'dashboard' | 'auftraege' | 'dispo' | 'verdienst';
  onTabChange?: (tab: 'dashboard' | 'auftraege' | 'dispo' | 'verdienst') => void;
}) => {
  const { logout } = useAuth();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brandAndNav}>
            <Link to="/fahrer" className={styles.logoLink}>
              <img 
                src="https://assets.floot.app/369c3501-fab4-4d1f-9c4f-7e589a5b18c1/1ce32e1f-d8cc-4c4c-8458-b1f929638cdc.png" 
                alt="Biber Fieber" 
                className={styles.logo} 
              />
              <span className={styles.driverBadge}>Fahrer</span>
            </Link>
            
            <nav className={styles.nav}>
              <button 
                onClick={() => onTabChange?.('dashboard')}
                className={`${styles.navLink} ${activeTab === 'dashboard' ? styles.active : ''}`}
              >
                <LayoutDashboard size={18} /> Dashboard
              </button>
              <button 
                onClick={() => onTabChange?.('auftraege')}
                className={`${styles.navLink} ${activeTab === 'auftraege' ? styles.active : ''}`}
              >
                <Truck size={18} /> Aufträge
              </button>
              <button 
                onClick={() => onTabChange?.('dispo')}
                className={`${styles.navLink} ${activeTab === 'dispo' ? styles.active : ''}`}
              >
                <Phone size={18} /> Dispo
              </button>
              <button 
                onClick={() => onTabChange?.('verdienst')}
                className={`${styles.navLink} ${activeTab === 'verdienst' ? styles.active : ''}`}
              >
                <Coins size={18} /> Verdienst
              </button>
            </nav>
          </div>
          
          <div className={styles.actions}>
            <Link to="/" className={styles.backLink}>
              <ArrowLeft size={16} /> Zurück zum Shop
            </Link>
            <button className={styles.logoutBtn} onClick={() => logout()}>
              <LogOut size={16} /> Abmelden
            </button>
          </div>
        </div>
      </header>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
};