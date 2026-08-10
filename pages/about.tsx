import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { useTranslation } from '../helpers/useTranslation';
import { resolveFileUrl } from '../helpers/resolveFileUrl';
import styles from './about.module.css';

type Section = {
  src: string;
  alt: string;
  link?: string;
  label?: string;
};

export default function AboutPage() {
  const { t } = useTranslation();

  const sections: Section[] = [
    {
      src: "/_cdn/static/biber-fieber-hero.jpg",
      alt: "Bist du schon im Biber Fieber?"
    },
    {
      src: "/_cdn/static/biber-familie.jpg",
      alt: "Biber Familie",
      link: "/account?tab=spenden",
      label: t("about.biber_smile")
    },
    {
      src: "/_cdn/static/biber-bonus.jpg",
      alt: "Biber Bonus",
      link: "/account?tab=guthaben",
      label: t("about.topup_balance")
    },
    {
      src: "/_cdn/static/biber-freunde.jpg",
      alt: "Biber Freunde",
      link: "/account?tab=bibercode",
      label: t("about.biber_friends")
    }
  ];

  return (
    <div className={styles.pageContainer}>
      <Helmet>
        <title>{`${t("nav.about")} | Biber Fieber`}</title>
        <meta name="description" content={t("about.meta_desc") || "Erfahre mehr über Biber Fieber, deinen Bio-Frühstück Lieferservice."} />
      </Helmet>
      
      {sections.map((section, index) =>
        <section key={index} className={styles.imageSection}>
          <div className={styles.imageWrapper}>
            <img src={resolveFileUrl(section.src)} alt={section.alt} className={styles.fullWidthImage} />
          </div>
          <Button asChild className={styles.ctaButton}>
            <Link to={section.link || "/shop"}>{section.label || t("about.order_now")}</Link>
          </Button>
        </section>
      )}
    </div>);

}