import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "../helpers/useDebounce";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
  useForm,
} from "./Form";
import { Input } from "./Input";
import { Button } from "./Button";
import { Spinner } from "./Spinner";
import { Eye, EyeOff, Check, X as XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./Dialog";
import { useAuth } from "../helpers/useAuth";
import {
  schema,
  postRegister,
} from "../endpoints/auth/register_with_password_POST.schema";
import { getDeliveryZoneCheck } from "../endpoints/delivery-zones/check_GET.schema";
import { getDeliveryZonesList } from "../endpoints/delivery-zones/list_GET.schema";
import { useTranslation } from "../helpers/useTranslation";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./Select";
import { getValidateBibercode } from "../endpoints/referral/validate_GET.schema";
import { getCheckEmail } from "../endpoints/auth/check-email_GET.schema";
import styles from "./PasswordRegisterForm.module.css";

function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return digits.slice(0, 2) + '.' + digits.slice(2);
  return digits.slice(0, 2) + '.' + digits.slice(2, 4) + '.' + digits.slice(4);
}

function convertDEtoISO(dateStr: string): string {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return dateStr;
}

export type RegisterFormData = z.infer<typeof schema>;

interface InactiveZoneInfo {
  postcode: string;
  userCount: number;
  activationThreshold: number | null;
  hasZone: boolean;
}

interface PasswordRegisterFormProps {
  className?: string;
  defaultValues?: Partial<RegisterFormData>;
  showCompanyName?: boolean;
}

export const PasswordRegisterForm: React.FC<PasswordRegisterFormProps> = ({
  className,
  defaultValues,
  showCompanyName,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inactiveZoneInfo, setInactiveZoneInfo] =
    useState<InactiveZoneInfo | null>(null);
  // Stores pending form data while waiting for user confirmation on inactive zone
  const [pendingFormData, setPendingFormData] =
    useState<RegisterFormData | null>(null);
  const { onLogin } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  type EmailStatus = { type: "idle" } | { type: "checking" } | { type: "taken" } | { type: "available" };
  const [emailStatus, setEmailStatus] = useState<EmailStatus>({ type: "idle" });

  type BibercodeStatus =
    | { type: "idle" }
    | { type: "checking" }
    | { type: "valid"; ownerName: string }
    | { type: "invalid" }
    | { type: "confirmed"; ownerName: string };

  const [bibercodeStatus, setBibercodeStatus] = useState<BibercodeStatus>({ type: "idle" });
  const [confirmedReferralCode, setConfirmedReferralCode] = useState<string | null>(null);

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
  const [showPassword, setShowPassword] = useState(false);

  const formSchema = React.useMemo(() => {
    return schema.superRefine((data, ctx) => {
      if (showCompanyName && (!data.companyName || data.companyName.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["companyName"],
          message: t('register.company_required'),
        });
      }
    });
  }, [showCompanyName, t]);

  const form = useForm({
    schema: formSchema,
    defaultValues: defaultValues || {
      salutation: "" as any,
      companyName: "",
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      postcode: "",
      city: "",
      streetAddress: "",
      mobileNumber: "",
      referralCode: "",
      dateOfBirth: "",
    },
  });

  const debouncedPostcode = useDebounce(form.values.postcode || "", 500);
  const rawReferralCode = form.values.referralCode || "";
  const debouncedReferralCode = useDebounce(rawReferralCode, 500);
  const rawEmail = form.values.email || "";
  const debouncedEmail = useDebounce(rawEmail, 500);

  useEffect(() => {
    if (!debouncedEmail.trim() || !debouncedEmail.includes('@') || !debouncedEmail.includes('.')) {
      setEmailStatus({ type: "idle" });
      return;
    }

    let isMounted = true;
    async function checkEmail() {
      setEmailStatus({ type: "checking" });
      try {
        const result = await getCheckEmail({ email: debouncedEmail });
        if (!isMounted) return;
        
        if (result.exists) {
          setEmailStatus({ type: "taken" });
        } else {
          setEmailStatus({ type: "available" });
        }
      } catch (err) {
        if (isMounted) {
          setEmailStatus({ type: "idle" });
        }
      }
    }

    checkEmail();
    return () => {
      isMounted = false;
    };
  }, [debouncedEmail]);

  useEffect(() => {
    if (!debouncedReferralCode.trim()) {
      setBibercodeStatus({ type: "idle" });
      setConfirmedReferralCode(null);
      return;
    }

    if (debouncedReferralCode === confirmedReferralCode) {
      return;
    }

    let isMounted = true;
    async function checkBibercode() {
      setBibercodeStatus({ type: "checking" });
      try {
        const result = await getValidateBibercode({ code: debouncedReferralCode });
        if (!isMounted) return;
        
        if (result.found && result.ownerName) {
          setBibercodeStatus({ type: "valid", ownerName: result.ownerName });
        } else {
          setBibercodeStatus({ type: "invalid" });
        }
      } catch (err) {
        if (isMounted) {
          setBibercodeStatus({ type: "idle" });
        }
      }
    }

    checkBibercode();
    return () => {
      isMounted = false;
    };
  }, [debouncedReferralCode, confirmedReferralCode]);

  useEffect(() => {
    async function checkZone() {
      if (debouncedPostcode.length >= 4) {
        setZoneStatus({ type: "checking" });
        try {
          const zoneCheck = await getDeliveryZoneCheck({
            postcode: debouncedPostcode,
            checkThreshold: true,
          });
          if (zoneCheck !== null) {
            setZoneStatus({ type: "active" });
          } else {
            const zones = await getDeliveryZonesList();
            const regexMatch = zones.find((zone) => {
              const regexStr =
                "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
              try {
                return new RegExp(regexStr).test(debouncedPostcode);
              } catch {
                return false;
              }
            });
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
          setZoneStatus(null);
        }
      } else {
        setZoneStatus(null);
      }
    }
    checkZone();
  }, [debouncedPostcode]);

  const performRegistration = async (data: RegisterFormData) => {
    setError(null);
    setIsLoading(true);
    try {
      const finalData = { ...data };
      if (!confirmedReferralCode || confirmedReferralCode !== finalData.referralCode) {
        finalData.referralCode = undefined;
      }
      const result = await postRegister(finalData);
      console.log("Registration successful for:", data.email);
      onLogin(result.user);
      navigate("/");
    } catch (err) {
      console.error("Registration error:", err);
      if (err instanceof Error) {
        const errorMessage = err.message;
        if (errorMessage.includes("Email already in use")) {
          setError(
            t('register.email_already_registered')
          );
        } else {
          setError(errorMessage || t('register.registration_failed'));
        }
      } else {
        setError(t('register.registration_failed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (rawData: RegisterFormData) => {
    if (rawData.referralCode && rawData.referralCode.trim() !== "" && confirmedReferralCode !== rawData.referralCode) {
      setError(t('register.confirm_bibercode_error'));
      return;
    }

    const data = { ...rawData };
    if (!showCompanyName) {
      delete data.companyName;
    }
    if (data.dateOfBirth) {
      data.dateOfBirth = convertDEtoISO(data.dateOfBirth);
    }

    setError(null);
    setIsLoading(true);

    try {
      // Check delivery zone BEFORE registration
      const zoneCheck = await getDeliveryZoneCheck({ postcode: data.postcode, checkThreshold: true });

      if (zoneCheck !== null) {
        // Zone is active — proceed with registration directly
        setIsLoading(false);
        await performRegistration(data);
      } else {
        // Zone is not active — fetch details and show dialog
        let zoneInfo: InactiveZoneInfo = {
          postcode: data.postcode,
          userCount: 0,
          activationThreshold: null,
          hasZone: false,
        };

        try {
          const zones = await getDeliveryZonesList();
          const regexMatch = zones.find((zone) => {
            const regexStr =
              "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
            try {
              return new RegExp(regexStr).test(data.postcode);
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
            setError(t('register.postcode_outside'));
          }
        } catch (zoneListError) {
          console.error("Failed to fetch zone list:", zoneListError);
          setPendingFormData(data);
          setInactiveZoneInfo(zoneInfo);
        }

        setIsLoading(false);
      }
    } catch (zoneError) {
      // If zone check fails, proceed with registration anyway — don't block the user
      console.error("Zone check failed before registration:", zoneError);
      setIsLoading(false);
      await performRegistration(data);
    }
  };

  const handleConfirmRegistration = async () => {
    if (!pendingFormData) return;
    const data = pendingFormData;
    setInactiveZoneInfo(null);
    setPendingFormData(null);
    await performRegistration(data);
  };

  const handleCancelInactiveZoneDialog = () => {
    setInactiveZoneInfo(null);
    setPendingFormData(null);
  };

  const removeBibercode = () => {
    form.setValues((prev) => ({ ...prev, referralCode: "" }));
    setBibercodeStatus({ type: "idle" });
    setConfirmedReferralCode(null);
  };

  const confirmBibercode = (ownerName: string) => {
    setConfirmedReferralCode(rawReferralCode);
    setBibercodeStatus({ type: "confirmed", ownerName });
  };

  return (
    <>
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
            <Button
              onClick={handleConfirmRegistration}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Spinner size="sm" /> {t("register.checking")}
                </>
              ) : (
                t("register.register_anyway")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Form {...form}>
        {error && <div className={styles.errorMessage}>{error}</div>}
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className={`${styles.form} ${className || ""}`}
        >
          <FormItem name="salutation">
            <FormLabel>{t('register.salutation')}</FormLabel>
            <FormControl>
              <Select
                value={form.values.salutation || "__empty"}
                onValueChange={(v) =>
                                    form.setValues((prev) => ({
                    ...prev,
                    salutation: (v === "__empty" ? "" : v) as any,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('register.salutation_placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Herr">{t('register.mr')}</SelectItem>
                  <SelectItem value="Frau">{t('register.mrs')}</SelectItem>
                  <SelectItem value="Herr Dr.">{t('register.mr_dr')}</SelectItem>
                                    <SelectItem value="Frau Dr.">{t('register.mrs_dr')}</SelectItem>
                  {showCompanyName && <SelectItem value="Firma">{t('register.company')}</SelectItem>}
                </SelectContent>
              </Select>
            </FormControl>
            <FormMessage />
          </FormItem>

          {showCompanyName && (
            <FormItem name="companyName">
              <FormLabel>{t('register.company_name')}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Musterfirma GmbH"
                  value={form.values.companyName || ""}
                  onChange={(e) =>
                    form.setValues((prev) => ({
                      ...prev,
                      companyName: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}

          <FormItem name="email">
            <FormLabel>{t("login_form.email")}</FormLabel>
            <FormControl>
              <Input
                type="email"
                placeholder="your@email.com"
                value={form.values.email || ""}
                onChange={(e) =>
                  form.setValues((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
            </FormControl>
            {emailStatus.type === "checking" && (
              <div className={styles.emailChecking}>{t('register.email_checking')}</div>
            )}
            {emailStatus.type === "taken" && (
              <div className={styles.emailTaken}>{t('register.email_registered')}</div>
            )}
            {emailStatus.type === "available" && (
              <div className={styles.emailAvailable}>
                {t('register.email_available')} <Check size={14} className={styles.inlineCheck} />
              </div>
            )}
            <FormMessage />
          </FormItem>

          <div className={styles.nameRow}>
            <FormItem name="firstName">
              <FormLabel>{t("register.firstname")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Max"
                  value={form.values.firstName || ""}
                  onChange={(e) =>
                    form.setValues((prev) => ({
                      ...prev,
                      firstName: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            <FormItem name="lastName">
              <FormLabel>{t("register.lastname")}</FormLabel>
              <FormControl>
                <Input
                  placeholder="Mustermann"
                  value={form.values.lastName || ""}
                  onChange={(e) =>
                    form.setValues((prev) => ({
                      ...prev,
                      lastName: e.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </div>

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
              />
            </FormControl>
            <FormMessage />
          </FormItem>

          <FormItem name="password">
            <FormLabel>{t("register.password")}</FormLabel>
            <FormControl>
              <div className={styles.passwordWrapper}>
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.values.password || ""}
                  onChange={(e) =>
                    form.setValues((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                />
                <button
                  type="button"
                  className={styles.passwordToggle}
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label="Passwort anzeigen/verbergen"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </FormControl>
            <FormDescription>
              {t("register.password_hint")}
            </FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="referralCode">
            <FormLabel>
              {t("register.bibercode")}{" "}
              <span className={styles.optionalLabel}>{t("register.optional")}</span>
            </FormLabel>
            <FormControl>
              <Input
                placeholder="z.B. BIBER123"
                value={form.values.referralCode || ""}
                disabled={bibercodeStatus.type === "confirmed"}
                onChange={(e) =>
                  form.setValues((prev) => ({
                    ...prev,
                    referralCode: e.target.value,
                  }))
                }
              />
            </FormControl>
            {bibercodeStatus.type === "checking" && (
              <div className={styles.bibercodeChecking}>{t('register.bibercode_checking')}</div>
            )}
            {bibercodeStatus.type === "invalid" && (
              <div className={styles.bibercodeInvalid}>{t('register.bibercode_not_found')}</div>
            )}
            {bibercodeStatus.type === "valid" && (
              <button 
                type="button" 
                className={styles.bibercodeValid}
                onClick={() => confirmBibercode(bibercodeStatus.ownerName)}
              >
                <span>{t('register.confirm_bibercode', { name: bibercodeStatus.ownerName })}</span>
              </button>
            )}
            {bibercodeStatus.type === "confirmed" && (
              <div className={styles.bibercodeConfirmed}>
                <Check size={16} /> {t('register.recommended_by', { name: bibercodeStatus.ownerName })}
                <button 
                  type="button"
                  className={styles.bibercodeRemove}
                  onClick={removeBibercode}
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}
            <FormDescription>
              {t("register.bibercode_hint")}
            </FormDescription>
            <FormMessage />
          </FormItem>

          <Button
            type="submit"
            disabled={isLoading || zoneStatus?.type === "no_zone" || emailStatus.type === "taken"}
            className={styles.submitButton}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" /> {t("register.checking")}
              </>
            ) : (
              t("register.create_account")
            )}
          </Button>
        </form>
      </Form>
    </>
  );
};