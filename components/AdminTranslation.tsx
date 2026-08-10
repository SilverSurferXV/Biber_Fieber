import React from 'react';
import { toast } from 'sonner';
import { useAdminTranslation } from '../helpers/useAdminTranslation';
import { Switch } from './Switch';
import { Skeleton } from './Skeleton';
import { EnabledLanguagesType } from '../endpoints/admin/translation_GET.schema';
import styles from './AdminTranslation.module.css';

const LANGUAGES = [
  { id: 'de', name: 'Deutsch', code: 'de', flag: '🇩🇪', alwaysOn: true },
  { id: 'en', name: 'Englisch', code: 'en', flag: '🇬🇧' },
  { id: 'es', name: 'Spanisch', code: 'es', flag: '🇪🇸' },
  { id: 'it', name: 'Italienisch', code: 'it', flag: '🇮🇹' },
  { id: 'tr', name: 'Türkisch', code: 'tr', flag: '🇹🇷' },
] as const;

export const AdminTranslation = () => {
  const { enabledLanguages, isLoading, error, saveLanguages, isSaving } = useAdminTranslation();

  const handleToggle = async (langId: keyof EnabledLanguagesType, newValue: boolean) => {
    if (!enabledLanguages) return;
    
    // Create the updated state to save
    const updatedLanguages = {
      ...enabledLanguages,
      [langId]: newValue
    };

    try {
      await saveLanguages(updatedLanguages);
      toast.success("Spracheinstellungen gespeichert");
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(`Fehler: ${err.message}`);
      } else {
        toast.error("Ein unbekannter Fehler ist aufgetreten.");
      }
    }
  };

  if (error) {
    return (
      <div className={styles.viewContainer}>
        <div className={styles.errorMessage}>
          Fehler beim Laden der Spracheinstellungen: {error instanceof Error ? error.message : "Unbekannter Fehler"}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <h2>Übersetzung</h2>
        <p className={styles.description}>
          Aktivieren oder deaktivieren Sie die verfügbaren Sprachen für die Benutzeroberfläche.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.languageList}>
          {isLoading ? (
            // Loading Skeletons
            Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className={styles.languageItem}>
                <div className={styles.languageInfo}>
                  <Skeleton style={{ width: '24px', height: '24px', borderRadius: '4px' }} />
                  <Skeleton style={{ width: '120px', height: '20px' }} />
                </div>
                <Skeleton style={{ width: '42px', height: '24px', borderRadius: '12px' }} />
              </div>
            ))
          ) : (
            // Loaded Language Items
            LANGUAGES.map((lang) => {
              const isBaseLanguage = 'alwaysOn' in lang && lang.alwaysOn;
              const isChecked = isBaseLanguage || (enabledLanguages && enabledLanguages[lang.id as keyof EnabledLanguagesType]);
              const isDisabled = isBaseLanguage || isSaving;

              return (
                <div key={lang.id} className={styles.languageItem}>
                  <div className={styles.languageInfo}>
                    <span className={styles.flag} aria-hidden="true">{lang.flag}</span>
                    <span className={styles.name}>{lang.name}</span>
                    <span className={styles.code}>({lang.code})</span>
                  </div>
                  
                  <Switch 
                    checked={isChecked}
                    disabled={isDisabled}
                    onCheckedChange={(checked) => {
                      if (!isBaseLanguage) {
                        handleToggle(lang.id as keyof EnabledLanguagesType, checked);
                      }
                    }}
                    aria-label={`${lang.name} aktivieren`}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};