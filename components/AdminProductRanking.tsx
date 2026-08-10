import React, { useMemo, useState } from "react";
import { Trophy, Medal, Award, Package, TrendingUp } from "lucide-react";
import { useAdminProductRanking } from "../helpers/useAdminProductRanking";
import { Skeleton } from "./Skeleton";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Input } from "./Input";
import styles from "./AdminProductRanking.module.css";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(value);
};

const formatDateDE = (isoDate: string): string => {
  const [year, month, day] = isoDate.split("-");
  return `${day}.${month}.${year}`;
};

const getTodayISO = (): string => {
  return new Date().toISOString().split("T")[0];
};

const getStartOfWeekISO = (): string => {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split("T")[0];
};

const getStartOfMonthISO = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
};

const getStartOfYearISO = (): string => {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0];
};

type PresetKey = "heute" | "woche" | "monat" | "jahr" | "gesamt";

interface DatePreset {
  key: PresetKey;
  label: string;
  getRange: () => { startDate: string | undefined; endDate: string | undefined };
}

const DATE_PRESETS: DatePreset[] = [
  {
    key: "heute",
    label: "Heute",
    getRange: () => ({ startDate: getTodayISO(), endDate: getTodayISO() }),
  },
  {
    key: "woche",
    label: "Diese Woche",
    getRange: () => ({ startDate: getStartOfWeekISO(), endDate: getTodayISO() }),
  },
  {
    key: "monat",
    label: "Dieser Monat",
    getRange: () => ({ startDate: getStartOfMonthISO(), endDate: getTodayISO() }),
  },
  {
    key: "jahr",
    label: "Dieses Jahr",
    getRange: () => ({ startDate: getStartOfYearISO(), endDate: getTodayISO() }),
  },
  {
    key: "gesamt",
    label: "Gesamt",
    getRange: () => ({ startDate: undefined, endDate: undefined }),
  },
];

const RankIcon = ({ rank }: { rank: number }) => {
  if (rank === 1) return <Trophy size={18} className={styles.rankGold} />;
  if (rank === 2) return <Medal size={18} className={styles.rankSilver} />;
  if (rank === 3) return <Award size={18} className={styles.rankBronze} />;
  return <span className={styles.rankNumber}>{rank}</span>;
};

const getSubtitle = (startDate: string | undefined, endDate: string | undefined): string => {
  if (!startDate && !endDate) {
    return "Alle Produkte sortiert nach Verkaufszahlen (Gesamt)";
  }
  if (startDate && endDate) {
    return `Verkaufszahlen von ${formatDateDE(startDate)} bis ${formatDateDE(endDate)}`;
  }
  if (startDate) {
    return `Verkaufszahlen ab ${formatDateDE(startDate)}`;
  }
  if (endDate) {
    return `Verkaufszahlen bis ${formatDateDE(endDate)}`;
  }
  return "Alle Produkte sortiert nach Verkaufszahlen";
};

const detectActivePreset = (
  startDate: string | undefined,
  endDate: string | undefined
): PresetKey | null => {
  for (const preset of DATE_PRESETS) {
    const range = preset.getRange();
    if (range.startDate === startDate && range.endDate === endDate) {
      return preset.key;
    }
  }
  return null;
};

export const AdminProductRanking = ({ className }: { className?: string }) => {
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  const { data, isFetching, isError } = useAdminProductRanking({ startDate, endDate });

  const activePreset = detectActivePreset(startDate, endDate);

  const { totalProducts, totalUnitsSold, totalRevenue } = useMemo(() => {
    if (!data) return { totalProducts: 0, totalUnitsSold: 0, totalRevenue: 0 };
    return {
      totalProducts: data.length,
      totalUnitsSold: data.reduce((acc, p) => acc + p.totalSold, 0),
      totalRevenue: data.reduce((acc, p) => acc + p.totalRevenue, 0),
    };
  }, [data]);

  const applyPreset = (preset: DatePreset) => {
    const range = preset.getRange();
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const subtitle = getSubtitle(startDate, endDate);

  if (isFetching && !data) {
    return (
      <div className={`${styles.viewContainer} ${className || ""}`}>
        <div className={styles.header}>
          <div>
            <h2>Produkt Rangliste</h2>
            <p className={styles.subtitle}>Alle Produkte sortiert nach Verkaufszahlen</p>
          </div>
        </div>
        <div className={styles.statsGrid}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} style={{ height: "90px" }} />
          ))}
        </div>
        <div className={styles.sectionBox}>
          <Skeleton style={{ height: "400px" }} />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={`${styles.viewContainer} ${className || ""}`}>
        <p>Fehler beim Laden der Produkt Rangliste.</p>
      </div>
    );
  }

  return (
    <div className={`${styles.viewContainer} ${className || ""}`}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <h2>Produkt Rangliste</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>

        <div className={styles.filterArea}>
          <div className={styles.presetRow}>
            {DATE_PRESETS.map((preset) => (
              <Button
                key={preset.key}
                size="sm"
                variant={activePreset === preset.key ? "primary" : "outline"}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className={styles.dateInputRow}>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Von</label>
              <Input
                type="date"
                value={startDate ?? ""}
                onChange={(e) => {
                  setStartDate(e.target.value || undefined);
                }}
                className={styles.dateInput}
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.dateLabel}>Bis</label>
              <Input
                type="date"
                value={endDate ?? ""}
                onChange={(e) => {
                  setEndDate(e.target.value || undefined);
                }}
                className={styles.dateInput}
              />
            </div>
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper}>
            <Package size={20} className={styles.statIcon} />
          </div>
          <div>
            <div className={styles.statLabel}>Alle Produkte</div>
            <div className={styles.statValue}>{totalProducts}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper}>
            <TrendingUp size={20} className={styles.statIcon} />
          </div>
          <div>
            <div className={styles.statLabel}>Verkaufte Einheiten (Gesamt)</div>
            <div className={styles.statValue}>{totalUnitsSold}</div>
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper}>
            <Trophy size={20} className={styles.statIcon} />
          </div>
          <div>
            <div className={styles.statLabel}>Umsatz (Gesamt)</div>
            <div className={styles.statValue}>{formatCurrency(totalRevenue)}</div>
          </div>
        </div>
      </div>

      <div className={styles.sectionBox}>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.centerAlign}>#Rang</th>
                <th>Foto</th>
                <th>Artikelnr.</th>
                <th>Name</th>
                <th>Kategorie</th>
                <th className={styles.rightAlign}>Verkauft (Stk.)</th>
                <th className={styles.rightAlign}>Umsatz (€)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.map((product) => (
                <tr key={product.productId}>
                  <td className={styles.centerAlign}>
                    <div className={styles.rankCell}>
                      <RankIcon rank={product.rank} />
                    </div>
                  </td>
                  <td>
                    {product.photoUrl ? (
                      <img
                        src={product.photoUrl}
                        alt={product.name}
                        className={styles.thumbnail}
                        loading="lazy"
                      />
                    ) : (
                      <div className={styles.thumbnailPlaceholder}>
                        <Package size={16} />
                      </div>
                    )}
                  </td>
                  <td className={styles.monoText}>{product.articleNumber}</td>
                  <td className={styles.strongText}>{product.name}</td>
                  <td>{product.categoryName || "-"}</td>
                  <td className={styles.rightAlign}>{product.totalSold}</td>
                  <td className={`${styles.rightAlign} ${styles.monoText}`}>
                    {formatCurrency(product.totalRevenue)}
                  </td>
                  <td>
                    <Badge variant={product.active ? "success" : "secondary"}>
                      {product.active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={8} className={styles.emptyState}>
                    Keine Produkte gefunden
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};