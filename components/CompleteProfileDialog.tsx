import React, { useState, useEffect, useMemo } from "react";
import * as z from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { useDebounce } from "../helpers/useDebounce";
import { useTranslation } from "../helpers/useTranslation";
import { useUpdateProfile } from "../helpers/useCustomerApi";
import { getDeliveryZoneCheck } from "../endpoints/delivery-zones/check_GET.schema";
import { getDeliveryZonesList } from "../endpoints/delivery-zones/list_GET.schema";
import { isAdult } from "../helpers/isAdult";
import styles from "./CompleteProfileDialog.module.css";

interface CompleteProfileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  profile:
    | {
        postcode?: string | null;
        city?: string | null;
        streetAddress?: string | null;
        mobileNumber?: string | null;
        dateOfBirth?: Date | string | null;
      }
    | null
    | undefined;
  onCompleted: () => void;
}

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + "." + digits.slice(2);
  return digits.slice(0, 2) + "." + digits.slice(2, 4) + "." + digits.slice(4);
}

function convertDEtoISO(dateStr: string): string {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return dateStr;
}

function formatInitialDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

interface InactiveZoneInfo {
  postcode: string;
  userCount: number;
  activationThreshold: number | null;
  hasZone: boolean;
}

export const CompleteProfileDialog: React.FC<CompleteProfileDialogProps> = ({
  isOpen,
  onClose,
  profile,
  onCompleted,
}) => {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [inactiveZoneInfo, setInactiveZoneInfo] = useState<InactiveZoneInfo | null>(null);
  
  // Pending form data when confirming inactive zone
  type FormData = z.infer<ReturnType<typeof useFormSchema>>;
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const { mutateAsync: updateProfile } = useUpdateProfile();

  type ZoneStatus =
    | { type: "checking" }
    | { type: "active" }
    | {
        type: "inactive";
        userCount: number;
        activationThreshold: number | null;
        hasZone: boolean;
        cityName: string | null;
      }
    | { type: "no_zone" }
    | null;

  const [zoneStatus, setZoneStatus] = useState<ZoneStatus>(null);

  const useFormSchema = () => {
    return useMemo(() => {
      return z.object({
        postcode: z.string().min(1, t("profile.error")),
        city: z.string().min(1, t("profile.error")),
        streetAddress: z.string().min(1, t("profile.error")),
        mobileNumber: z.string().min(1, t("profile.error")),
        dateOfBirth: z
          .string()
          .regex(/^\d{2}\.\d{2}\.\d{4}$/, "Format: TT.MM.JJJJ")
          .refine((val) => isAdult(convertDEtoISO(val)), {
            message: t("age.min_18"),
          }),
      });
    }, [t]);
  };

  const formSchema = useFormSchema();

  const form = useForm({
    schema: formSchema,
    defaultValues: {
      postcode: profile?.postcode || "",
      city: profile?.city || "",
      streetAddress: profile?.streetAddress || "",
      mobileNumber: profile?.mobileNumber || "",
      dateOfBirth: formatInitialDate(profile?.dateOfBirth),
    },
  });

  const debouncedPostcode = useDebounce(form.values.postcode || "", 500);

  useEffect(() => {
    // Refresh form when profile prop changes
    form.setValues({
      postcode: profile?.postcode || "",
      city: profile?.city || "",
      streetAddress: profile?.streetAddress || "",
      mobileNumber: profile?.mobileNumber || "",
      dateOfBirth: formatInitialDate(profile?.dateOfBirth),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    let isMounted = true;
    async function checkZone() {
      if (debouncedPostcode.length >= 4) {
        setZoneStatus({ type: "checking" });
        try {
          const zoneCheck = await getDeliveryZoneCheck({
            postcode: debouncedPostcode,
            checkThreshold: true,
          });
          if (!isMounted) return;

          if (zoneCheck !== null) {
            setZoneStatus({ type: "active" });
          } else {
            const zones = await getDeliveryZonesList();
            const regexMatch = zones.find((zone) => {
              const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
              try {
                return new RegExp(regexStr).test(debouncedPostcode);
              } catch {
                return false;
              }
            });

            if (!isMounted) return;

            if (regexMatch !== undefined) {
              setZoneStatus({
                type: "inactive",
                userCount: regexMatch.userCount,
                activationThreshold: regexMatch.activationThreshold,
                hasZone: true,
                cityName: regexMatch.cityName,
              });
            } else {
              setZoneStatus({ type: "no_zone" });
            }
          }
        } catch (err) {
          if (isMounted) setZoneStatus(null);
        }
      } else {
        setZoneStatus(null);
      }
    }
    checkZone();
    return () => {
      isMounted = false;
    };
  }, [debouncedPostcode]);

  const performUpdate = async (data: FormData) => {
    setIsLoading(true);
    try {
      await updateProfile({
        postcode: data.postcode,
        city: data.city,
        streetAddress: data.streetAddress,
        mobileNumber: data.mobileNumber,
        dateOfBirth: convertDEtoISO(data.dateOfBirth),
      });
      toast.success(t("profile.success"));
      onCompleted();
      onClose();
    } catch (err) {
      console.error("Update profile error:", err);
      toast.error(
        err instanceof Error ? err.message : t("notifications.error")
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      const zoneCheck = await getDeliveryZoneCheck({
        postcode: data.postcode,
        checkThreshold: true,
      });

      if (zoneCheck !== null) {
        // Active zone
        setIsLoading(false);
        await performUpdate(data);
      } else {
        // Inactive or no zone
        let zoneInfo: InactiveZoneInfo = {
          postcode: data.postcode,
          userCount: 0,
          activationThreshold: null,
          hasZone: false,
        };

        try {
          const zones = await getDeliveryZonesList();
          const regexMatch = zones.find((zone) => {
            const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
            try {
              return new RegExp(regexStr).test(data.postcode ?? "");
            } catch {
              return false;
            }
          });

          if (regexMatch !== undefined) {
            zoneInfo = {
              postcode: data.postcode,
              userCount: regexMatch.userCount,
              activationThreshold: regexMatch.activationThreshold,
              hasZone: true,
            };
            setPendingFormData(data);
            setInactiveZoneInfo(zoneInfo);
          } else {
            toast.error(t("register.postcode_outside"));
          }
        } catch (zoneListError) {
          console.error("Failed to fetch zone list:", zoneListError);
          setPendingFormData(data);
          setInactiveZoneInfo(zoneInfo);
        }

        setIsLoading(false);
      }
    } catch (zoneError) {
      console.error("Zone check failed before update:", zoneError);
      setIsLoading(false);
      await performUpdate(data);
    }
  };

  const handleConfirmUpdate = async () => {
    if (!pendingFormData) return;
    const data = pendingFormData;
    setInactiveZoneInfo(null);
    setPendingFormData(null);
    await performUpdate(data);
  };

  const handleCancelInactiveZoneDialog = () => {
    setInactiveZoneInfo(null);
    setPendingFormData(null);
  };

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(open) => {
          if (!open && !isLoading) onClose();
        }}
      >
        <DialogContent className={styles.dialogContent}>
          <DialogHeader>
            <DialogTitle>{t("complete_profile.title")}</DialogTitle>
            <DialogDescription>
              {t("complete_profile.description")}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className={styles.form}
            >
              <div className={styles.postcodeRow}>
                <FormItem name="postcode" className={styles.postcodeField}>
                  <FormLabel>{t("register.zip")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="10115"
                      value={form.values.postcode || ""}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          postcode: e.target.value,
                        }))
                      }
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>

                <FormItem name="city" className={styles.cityField}>
                  <FormLabel>{t("register.city")}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Berlin"
                      value={form.values.city || ""}
                      onChange={(e) =>
                        form.setValues((prev) => ({
                          ...prev,
                          city: e.target.value,
                        }))
                      }
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </div>

              {zoneStatus && (
                <div
                  className={
                    zoneStatus.type === "active"
                      ? styles.zoneStatusActive
                      : zoneStatus.type === "inactive"
                        ? styles.zoneStatusInactive
                        : zoneStatus.type === "no_zone"
                          ? styles.zoneStatusNoZone
                          : styles.zoneStatusChecking
                  }
                >
                  {zoneStatus.type === "checking" && t("register.checking_zip")}
                  {zoneStatus.type === "active" && t("register.zip_active")}
                  {zoneStatus.type === "inactive" && t("register.zone_inactive_1")}
                  {zoneStatus.type === "no_zone" && t("register.postcode_outside")}
                </div>
              )}

              <FormItem name="streetAddress">
                <FormLabel>{t("register.street")}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Musterstraße 42"
                    value={form.values.streetAddress || ""}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        streetAddress: e.target.value,
                      }))
                    }
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="mobileNumber">
                <FormLabel>{t("register.mobile")}</FormLabel>
                <FormControl>
                  <Input
                    type="tel"
                    placeholder="+49 176 12345678"
                    value={form.values.mobileNumber || ""}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        mobileNumber: e.target.value,
                      }))
                    }
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <FormItem name="dateOfBirth">
                <FormLabel>{t("register.dob")}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="TT.MM.JJJJ"
                    value={form.values.dateOfBirth || ""}
                    onChange={(e) =>
                      form.setValues((prev) => ({
                        ...prev,
                        dateOfBirth: formatDateInput(e.target.value),
                      }))
                    }
                    disabled={isLoading}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>

              <DialogFooter className={styles.footer}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isLoading}
                >
                  {t("complete_profile.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={
                                        isLoading ||
                    (!!form.values.postcode && zoneStatus?.type === "no_zone")
                  }
                >
                  {isLoading ? (
                    <>
                      <Spinner size="sm" /> {t("checkout.processing")}
                    </>
                  ) : (
                    t("complete_profile.save_continue")
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inactiveZoneInfo !== null}
        onOpenChange={(open) => {
          if (!open) handleCancelInactiveZoneDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("checkout.zone_inactive")}</DialogTitle>
            <DialogDescription>
              {t("register.zone_inactive_1")}
              <br />
              {t("register.zone_inactive_2")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCancelInactiveZoneDialog}
              disabled={isLoading}
            >
              {t("profile.cancel")}
            </Button>
            <Button onClick={handleConfirmUpdate} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Spinner size="sm" /> {t("checkout.processing")}
                </>
              ) : (
                t("register.register_anyway")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};