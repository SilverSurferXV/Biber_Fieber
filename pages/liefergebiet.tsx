import React from "react";
import { MapContainer, TileLayer, Circle, Tooltip } from "react-leaflet";
import { MapPin, Users, Share2 } from "lucide-react";
import { useDeliveryZonesList } from "../helpers/useDeliveryZones";
import { useTranslation } from "../helpers/useTranslation";
import { useAuth } from "../helpers/useAuth";
import { toast } from "sonner";

import "leaflet/dist/leaflet.css";
import styles from "./liefergebiet.module.css";

const DELIVERY_ZONES = [
  { postcode: "82239", town: "Alling", lat: 48.15, lng: 11.3 },
  { postcode: "82205", town: "Gilching", lat: 48.108, lng: 11.293 },
  { postcode: "82140", town: "Olching", lat: 48.205, lng: 11.331 },
  { postcode: "82223", town: "Eichenau", lat: 48.172, lng: 11.321 },
  { postcode: "82194", town: "Gröbenzell", lat: 48.191, lng: 11.376 },
  { postcode: "82166", town: "Gräfelfing", lat: 48.119, lng: 11.445 },
  { postcode: "82178", town: "Puchheim", lat: 48.15, lng: 11.35 },
  { postcode: "82216", town: "Maisach", lat: 48.223, lng: 11.255 },
  { postcode: "82291", town: "Mammendorf", lat: 48.218, lng: 11.138 },
  { postcode: "82285", town: "Hattenhofen", lat: 48.217, lng: 11.117 },
  { postcode: "82110", town: "Germering", lat: 48.131, lng: 11.370 },
  { postcode: "82256", town: "Fürstenfeldbruck", lat: 48.183, lng: 11.246 },
  { postcode: "82275", town: "Emmering", lat: 48.192, lng: 11.284 },
  { postcode: "82290", town: "Landsberied", lat: 48.167, lng: 11.167 },
  { postcode: "82284", town: "Grafrath", lat: 48.124, lng: 11.160 },
  { postcode: "82288", town: "Kottgeisering", lat: 48.118, lng: 11.132 },
  { postcode: "82272", town: "Moorenweis", lat: 48.153, lng: 11.081 },
  { postcode: "82299", town: "Türkenfeld", lat: 48.117, lng: 11.083 },
  { postcode: "82152", town: "Planegg/Krailling", lat: 48.1, lng: 11.4 },
  { postcode: "81241-81249", town: "Lochhausen-Langwied-Aubing", lat: 48.158, lng: 11.442 },
  { postcode: "82294", town: "Oberschweinbach", lat: 48.25, lng: 11.167 },
  { postcode: "82237", town: "Wörthsee", lat: 48.083, lng: 11.2 },
  { postcode: "82229", town: "Seefeld", lat: 48.033, lng: 11.2 },
  { postcode: "82131", town: "Gauting", lat: 48.065, lng: 11.369 },
  { postcode: "82234", town: "Weßling", lat: 48.071, lng: 11.251 },
  { postcode: "82211", town: "Herrsching", lat: 47.999, lng: 11.176 },
  { postcode: "82266", town: "Inning", lat: 48.076, lng: 11.152 },
];

export default function LiefergebietPage() {
  const { t } = useTranslation();
  const { data: fetchedZones } = useDeliveryZonesList();
  const { authState } = useAuth();

  const bibercode = authState.type === "authenticated" ? authState.user.bibercode : null;

  const handleShare = async (postcode: string, town: string) => {
    const baseUrl = "https://biberfieber.floot.app/login?tab=register";
    const shareUrl = bibercode ? `${baseUrl}&bibercode=${bibercode}` : baseUrl;
    const rawShare = t("liefergebiet.share_text", { postcode, town });
    const shareText = rawShare !== "liefergebiet.share_text" 
      ? `${rawShare}\n${shareUrl}`
      : `Lass uns zusammen die PLZ ${postcode} (${town}) voll machen! 🦫\n${shareUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Biber Fieber",
          text: shareText,
        });
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          navigator.clipboard.writeText(shareText);
          toast.success(t("liefergebiet.link_copied"));
        }
      }
    } else {
      navigator.clipboard.writeText(shareText);
      toast.success(t("liefergebiet.link_copied"));
    }
  };

  // Center of the map: Fürstenfeldbruck area
  const mapCenter: [number, number] = [48.15, 11.25];

  const zones = React.useMemo(() => {
    return DELIVERY_ZONES.map((staticZone) => {
      const fetched = fetchedZones?.find((fz) => {
        const regexStr = "^" + fz.postcodePattern.replace(/\*/g, ".*") + "$";
        const regex = new RegExp(regexStr);
        return regex.test(staticZone.postcode);
      });

      const userCount = fetched?.userCount ?? 0;
      const activationThreshold = fetched?.activationThreshold ?? 0;
      const isActive = !activationThreshold || userCount >= activationThreshold;

      return {
        ...staticZone,
        userCount,
        activationThreshold,
        isActive,
      };
    });
  }, [fetchedZones]);

  // Sort zones by postcode for the legend to maintain a clean order
  const sortedZones = [...zones].sort((a, b) =>
    a.postcode.localeCompare(b.postcode)
  );

  const cardRefs = React.useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToCard = (postcode: string) => {
    const el = cardRefs.current[postcode];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        el.classList.add(styles.blinkAnimation);
        setTimeout(() => {
          el.classList.remove(styles.blinkAnimation);
        }, 1300); // 3 * 400ms + buffer
      }, 500); // wait for smooth scroll to finish
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroSection}>
        <h1 className={styles.title}>{t("liefergebiet.title")}</h1>
        <p className={styles.subtitle}>{t("liefergebiet.subtitle")}</p>
      </div>

      <div className={styles.mapWrapper}>
        <MapContainer
          center={mapCenter}
          zoom={11}
          scrollWheelZoom={false}
          className={styles.mapElement}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {zones.map((zone) => (
            <Circle
              key={zone.postcode}
              center={[zone.lat, zone.lng]}
              eventHandlers={{ click: () => scrollToCard(zone.postcode) }}
              radius={1500}
              pathOptions={{
                color: zone.isActive ? "#6ECFB5" : "#6b7280",
                fillColor: zone.isActive ? "#6ECFB5" : "#6b7280",
                fillOpacity: 0.35,
                weight: 2,
              }}
            >
              <Tooltip permanent direction="center" className={styles.zoneTooltip}>
                {zone.postcode}
              </Tooltip>
            </Circle>
          ))}
        </MapContainer>
      </div>

      <div className={styles.legendSection}>
        <h2 className={styles.legendTitle}>{t("liefergebiet.served_zips")}</h2>
        <div className={styles.legendGrid}>
          {sortedZones.map((zone) => (
            <div
              key={zone.postcode}
              ref={(el) => {
                cardRefs.current[zone.postcode] = el;
              }}
              className={`${styles.legendCard} ${
                !zone.isActive ? styles.inactiveCard : ""
              }`}
            >
              <div className={styles.statusBadge}>
                <span
                  className={`${styles.statusDot} ${
                    zone.isActive ? styles.statusDotActive : styles.statusDotInactive
                  }`}
                />
                {zone.isActive ? t("liefergebiet.active") : t("liefergebiet.inactive")}
              </div>
              <div className={styles.legendIconWrapper}>
                <MapPin className={styles.legendIcon} size={18} />
              </div>
              <div className={styles.legendInfo}>
                <span className={styles.postcode}>{zone.postcode}</span>
                <span className={styles.town}>{zone.town}</span>
                <div className={styles.userCount}>
                  <Users size={14} />
                  <span>
                    {zone.activationThreshold > 0
                      ? `${zone.userCount} / ${zone.activationThreshold}`
                      : zone.userCount}
                  </span>
                </div>
              </div>
              <button
                className={styles.shareButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare(zone.postcode, zone.town);
                }}
              >
                <Share2 size={12} />
                {t("liefergebiet.share")}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}