import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/Tabs";
import {
  AdminProducts,
  AdminCategories,
  AdminOrders,
  AdminCustomers,
  AdminSettings,
  AdminSonderbereich,
} from "../components/AdminViews";
import { AdminDeliveryZones } from "../components/AdminDeliveryZones";
import { AdminBusinessCustomers } from "../components/AdminBusinessCustomers";
import { AdminDrivers } from "../components/AdminDrivers";
import { AdminDriverEarnings } from "../components/AdminDriverEarnings";
import { AdminPush } from "../components/AdminPush";
import { AdminProductRatings } from "../components/AdminProductRatings";
import { AdminDailyClosing } from "../components/AdminDailyClosing";
import { AdminStatistics } from "../components/AdminStatistics";
import { AdminProductRanking } from "../components/AdminProductRanking";
import { AdminAdministrators } from "../components/AdminAdministrators";
import { AdminStripe } from "../components/AdminStripe";
import { AdminPaypal } from "../components/AdminPaypal";
import { AdminMailjet } from "../components/AdminMailjet";
import { AdminEmailTemplates } from "../components/AdminEmailTemplates";
import { AdminDonations } from "../components/AdminDonations";
import { AdminContactForm } from "../components/AdminContactForm";
import { AdminSuppliers } from "../components/AdminSuppliers";
import { AdminNetworkTree } from "../components/AdminNetworkTree";
import { AdminTranslation } from "../components/AdminTranslation";
import { useMicrosoftUnreadCount } from "../helpers/useMicrosoftEmailsQueries";
import { Badge } from "../components/Badge";
import styles from "./admin.module.css";

export default function Admin() {
  const { data: unreadData } = useMicrosoftUnreadCount();
  const unreadCount = unreadData?.connected ? (unreadData?.unreadCount ?? 0) : 0;

  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("admin-active-tab") || "produkte";
    }
    return "produkte";
  });

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin-active-tab", value);
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Admin Bereich</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange} className={styles.tabs}>
        <div className={styles.tabsListWrapper}>
          <div className={styles.desktopTabsWrapper}>
            <TabsList className={styles.tabsList}>
              <TabsTrigger value="produkte">Produkte</TabsTrigger>
              <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
              <TabsTrigger value="bestellungen">Bestellungen</TabsTrigger>
              <TabsTrigger value="kunden">Kunden</TabsTrigger>
              <TabsTrigger value="firmenkunden">Firmenkunden</TabsTrigger>
              <TabsTrigger value="lieferzonen">Lieferzonen</TabsTrigger>
              <TabsTrigger value="sonderbereich">Sonderbereich</TabsTrigger>
              <TabsTrigger value="push">Push</TabsTrigger>
            </TabsList>
            <TabsList className={styles.tabsListSecondary}>
              <TabsTrigger value="bewertung">Artikel Bewertung</TabsTrigger>
              <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
              <TabsTrigger value="kontaktformular">
                Kontaktformular
                {unreadCount > 0 && <Badge variant="destructive" style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', minWidth: '18px' }}>{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="lieferanten">Lieferanten</TabsTrigger>
              <TabsTrigger value="fahrer">Fahrer</TabsTrigger>
              <TabsTrigger value="fahrverguetung">Fahrervergütung</TabsTrigger>
              <TabsTrigger value="tagesabschluss">Umsatz Tagesabschluss</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>
            <TabsList className={styles.tabsListSecondary}>
              <TabsTrigger value="produktrangliste">Produkt Rangliste</TabsTrigger>
              <TabsTrigger value="administratoren">Administratoren</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
              <TabsTrigger value="paypal">PayPal</TabsTrigger>
              <TabsTrigger value="mailjet">Mailjet</TabsTrigger>
              <TabsTrigger value="email-vorlagen">Email Vorlagen</TabsTrigger>
              <TabsTrigger value="spenden">Biber Smile</TabsTrigger>
              <TabsTrigger value="netzwerk-baum">Netzwerk Baum</TabsTrigger>
              <TabsTrigger value="uebersetzung">Übersetzung</TabsTrigger>
            </TabsList>
          </div>
          <div className={styles.mobileTabsWrapper}>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="produkte">Produkte</TabsTrigger>
              <TabsTrigger value="kategorien">Kategorien</TabsTrigger>
              <TabsTrigger value="bestellungen">Bestellungen</TabsTrigger>
              <TabsTrigger value="kunden">Kunden</TabsTrigger>
            </TabsList>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="firmenkunden">Firmenkunden</TabsTrigger>
              <TabsTrigger value="lieferzonen">Lieferzonen</TabsTrigger>
              <TabsTrigger value="sonderbereich">Sonderbereich</TabsTrigger>
              <TabsTrigger value="push">Push</TabsTrigger>
            </TabsList>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="bewertung">Artikel Bewertung</TabsTrigger>
              <TabsTrigger value="einstellungen">Einstellungen</TabsTrigger>
              <TabsTrigger value="kontaktformular">
                Kontaktformular
                {unreadCount > 0 && <Badge variant="destructive" style={{ marginLeft: '6px', fontSize: '0.7rem', padding: '1px 6px', minWidth: '18px' }}>{unreadCount}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="lieferanten">Lieferanten</TabsTrigger>
            </TabsList>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="fahrer">Fahrer</TabsTrigger>
              <TabsTrigger value="fahrverguetung">Fahrervergütung</TabsTrigger>
              <TabsTrigger value="tagesabschluss">Tagesabschluss</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
            </TabsList>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="produktrangliste">Rangliste</TabsTrigger>
              <TabsTrigger value="administratoren">Administratoren</TabsTrigger>
              <TabsTrigger value="stripe">Stripe</TabsTrigger>
              <TabsTrigger value="paypal">PayPal</TabsTrigger>
            </TabsList>
            <TabsList className={styles.mobileTabsRow}>
              <TabsTrigger value="mailjet">Mailjet</TabsTrigger>
              <TabsTrigger value="email-vorlagen">Email Vorlagen</TabsTrigger>
              <TabsTrigger value="spenden">Biber Smile</TabsTrigger>
              <TabsTrigger value="netzwerk-baum">Netzwerk Baum</TabsTrigger>
              <TabsTrigger value="uebersetzung">Übersetzung</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className={styles.tabContentContainer}>
          <TabsContent value="produkte">
            <AdminProducts />
          </TabsContent>
          <TabsContent value="kategorien">
            <AdminCategories />
          </TabsContent>
          <TabsContent value="bestellungen">
            <AdminOrders />
          </TabsContent>
          <TabsContent value="kunden">
            <AdminCustomers />
          </TabsContent>
          <TabsContent value="firmenkunden">
            <AdminBusinessCustomers />
          </TabsContent>
          <TabsContent value="fahrer">
            <AdminDrivers />
          </TabsContent>
          <TabsContent value="fahrverguetung">
            <AdminDriverEarnings />
          </TabsContent>
          <TabsContent value="tagesabschluss">
            <AdminDailyClosing />
          </TabsContent>
          <TabsContent value="lieferzonen">
            <AdminDeliveryZones />
          </TabsContent>
          <TabsContent value="sonderbereich">
<AdminSonderbereich />
</TabsContent>
          <TabsContent value="push">
            <AdminPush />
          </TabsContent>
          <TabsContent value="bewertung">
            <AdminProductRatings />
          </TabsContent>
<TabsContent value="einstellungen">
<AdminSettings />
</TabsContent>
          <TabsContent value="kontaktformular">
            <AdminContactForm />
          </TabsContent>
          <TabsContent value="statistics">
            <AdminStatistics />
          </TabsContent>
          <TabsContent value="produktrangliste">
            <AdminProductRanking />
          </TabsContent>
          <TabsContent value="administratoren">
            <AdminAdministrators />
          </TabsContent>
          <TabsContent value="stripe">
            <AdminStripe />
          </TabsContent>
          <TabsContent value="paypal">
            <AdminPaypal />
          </TabsContent>
          <TabsContent value="mailjet">
            <AdminMailjet />
          </TabsContent>
          <TabsContent value="email-vorlagen">
            <AdminEmailTemplates />
          </TabsContent>
          <TabsContent value="spenden">
            <AdminDonations />
          </TabsContent>
          <TabsContent value="lieferanten">
            <AdminSuppliers />
          </TabsContent>
          <TabsContent value="netzwerk-baum">
            <AdminNetworkTree />
          </TabsContent>
          <TabsContent value="uebersetzung">
            <AdminTranslation />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
