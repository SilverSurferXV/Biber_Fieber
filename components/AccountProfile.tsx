import React, { useState, useEffect } from 'react';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from './Form';
import { Input } from './Input';
import { Button } from './Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { schema as profileSchema } from '../endpoints/customer/profile/update_POST.schema';
import { useUpdateProfile, useDeleteAccount } from '../helpers/useCustomerApi';
import { toast } from 'sonner';
import { Trash2, X, Camera } from 'lucide-react';
import { Textarea } from './Textarea';
import { Checkbox } from './Checkbox';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './Dialog';
import { useTranslation } from '../helpers/useTranslation';
import { getDeliveryZoneCheck } from '../endpoints/delivery-zones/check_GET.schema';
import { getDeliveryZonesList } from '../endpoints/delivery-zones/list_GET.schema';
import { useDebounce } from '../helpers/useDebounce';
import { isAdult } from '../helpers/isAdult';
import { z } from 'zod';
import styles from './AccountProfile.module.css';

export const AccountProfile = ({ profile }: { profile: any }) => {
  const { t } = useTranslation();

  const formSchema = React.useMemo(() => {
    return profileSchema.superRefine((data, ctx) => {
      if (data.dateOfBirth && !isAdult(data.dateOfBirth)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateOfBirth"],
          message: t("age.min_18"),
        });
      }
    });
  }, [t]);

  const formatDateForInput = (dateVal: any) => {
    if (!dateVal) return '';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch (e) {
      return '';
    }
  };

  const form = useForm({
    defaultValues: {
      salutation: profile.salutation || '',
      companyName: profile.companyName || '',
      firstName: profile.firstName || '',
      lastName: profile.lastName || '',
      streetAddress: profile.streetAddress || '',
      city: profile.city || '',
      postcode: profile.postcode || '',
      mobileNumber: profile.mobileNumber || '',
      dateOfBirth: formatDateForInput(profile.dateOfBirth),
      languagePreference: profile.languagePreference || 'de',
      notificationPreference: profile.notificationPreference || 'email',
      avatarUrl: profile.avatarUrl || '',
      dropoffDescription: profile.dropoffDescription || '',
      dropoffPhotoUrl: profile.dropoffPhotoUrl || '',
      newsletterOptIn: profile.newsletterOptIn ?? false,
      deliveryAddressSameAsBilling: profile.deliveryAddressSameAsBilling ?? true,
      deliveryCompanyName: profile.deliveryCompanyName || '',
      deliveryFirstName: profile.deliveryFirstName || '',
      deliveryLastName: profile.deliveryLastName || '',
      deliveryStreet: profile.deliveryStreet || '',
      deliveryPostcode: profile.deliveryPostcode || '',
      deliveryCity: profile.deliveryCity || '',
      deliveryMobileNumber: profile.deliveryMobileNumber || '',
    },
    schema: formSchema,
  });

  const { mutateAsync: updateProfile, isPending } = useUpdateProfile();
  const { mutateAsync: deleteAccount } = useDeleteAccount();
  const [showDropoffInfoDialog, setShowDropoffInfoDialog] = useState(false);

  const isBusinessCustomer = !!profile.companyName;

  type DeliveryZoneStatus = { type: "idle" } | { type: "checking" } | { type: "valid"; info?: string } | { type: "invalid" };
  const [deliveryZoneStatus, setDeliveryZoneStatus] = useState<DeliveryZoneStatus>({ type: "idle" });
  
  const debouncedDeliveryPostcode = useDebounce(form.values.deliveryPostcode || "", 500);

  type BillingZoneStatus = { type: "idle" } | { type: "checking" } | { type: "valid"; info?: string } | { type: "inactive" } | { type: "invalid" };
  const [billingZoneStatus, setBillingZoneStatus] = useState<BillingZoneStatus>({ type: "idle" });
  const debouncedBillingPostcode = useDebounce(form.values.postcode || "", 500);

  useEffect(() => {
    if (debouncedBillingPostcode.length < 4) {
      setBillingZoneStatus({ type: "idle" });
      return;
    }

    let isMounted = true;
    const checkPostcode = async () => {
      setBillingZoneStatus({ type: "checking" });
      try {
        const result = await getDeliveryZoneCheck({ postcode: debouncedBillingPostcode, checkThreshold: false });
        if (!isMounted) return;
        
        if (result) {
          setBillingZoneStatus({ type: "valid", info: t('profile.delivery_fee_info', { fee: result.deliveryFee }) });
        } else {
          const zones = await getDeliveryZonesList();
          const regexMatch = zones.find((zone) => {
            const regexStr = "^" + zone.postcodePattern.replace(/\*/g, ".*") + "$";
            try {
              return new RegExp(regexStr).test(debouncedBillingPostcode);
            } catch {
              return false;
            }
          });

          if (!isMounted) return;

          if (regexMatch !== undefined) {
            setBillingZoneStatus({ type: "inactive" });
          } else {
            setBillingZoneStatus({ type: "invalid" });
          }
        }
      } catch (e) {
        if (isMounted) setBillingZoneStatus({ type: "idle" });
      }
    };
    
    checkPostcode();
    
    return () => {
      isMounted = false;
    };
  }, [debouncedBillingPostcode, t]);

  useEffect(() => {
    if (form.values.deliveryAddressSameAsBilling || debouncedDeliveryPostcode.length < 4) {
      setDeliveryZoneStatus({ type: "idle" });
      return;
    }

    let isMounted = true;
    const checkPostcode = async () => {
      setDeliveryZoneStatus({ type: "checking" });
      try {
        const result = await getDeliveryZoneCheck({ postcode: debouncedDeliveryPostcode, checkThreshold: false });
        if (!isMounted) return;
        
        if (result) {
          setDeliveryZoneStatus({ type: "valid", info: t('profile.delivery_fee_info', { fee: result.deliveryFee }) });
        } else {
          setDeliveryZoneStatus({ type: "invalid" });
        }
      } catch (e) {
        if (isMounted) setDeliveryZoneStatus({ type: "idle" });
      }
    };
    
    checkPostcode();
    
    return () => {
      isMounted = false;
    };
  }, [debouncedDeliveryPostcode, form.values.deliveryAddressSameAsBilling]);

  const onSubmit = async (data: any) => {
    try {
      await updateProfile(data);
      toast.success(t("profile.success"));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("profile.error"));
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 200;
        const MAX_HEIGHT = 300;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width * MAX_HEIGHT) / height);
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
        form.setValues((prev: any) => ({ ...prev, dropoffPhotoUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
                const MAX_SIZE = 450;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        form.setValues((prev: any) => ({ ...prev, avatarUrl: dataUrl }));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerAvatarUpload = () => {
    document.getElementById('avatarPhotoInput')?.click();
  };

  const triggerPhotoUpload = () => {
    setShowDropoffInfoDialog(false);
    setTimeout(() => {
      document.getElementById('dropoffPhotoInput')?.click();
    }, 100);
  };

  const handleDelete = async () => {
    try {
      await deleteAccount({});
      toast.success(t("profile.account_deleted"));
      window.location.href = '/';
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t("profile.error"));
    }
  };

  return (
    <div className={styles.viewContainer}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className={styles.formGrid}>
          <div className={styles.profileHeaderRow}>
            <div className={styles.nameFieldsCol}>
              {isBusinessCustomer && (
                <>
                  <FormItem name="salutation">
                    <FormLabel>{t("profile.salutation")}</FormLabel>
                    <Select value={form.values.salutation || ''} onValueChange={v => form.setValues(p => ({ ...p, salutation: v }))}>
                      <SelectTrigger><SelectValue placeholder={t("profile.salutation_placeholder")} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Herr">{t("profile.mr")}</SelectItem>
                        <SelectItem value="Frau">{t("profile.mrs")}</SelectItem>
                        <SelectItem value="Firma">{t("profile.company_label")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                  <FormItem name="companyName">
                    <FormLabel>{t("profile.company_name")}</FormLabel>
                    <FormControl><Input value={form.values.companyName || ''} onChange={e => form.setValues(p => ({ ...p, companyName: e.target.value }))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                </>
              )}
              <FormItem name="firstName">
                <FormLabel>{t("profile.firstname")}</FormLabel>
                <FormControl><Input value={form.values.firstName || ''} onChange={e => form.setValues(p => ({ ...p, firstName: e.target.value }))} /></FormControl>
                <FormMessage />
              </FormItem>
              <FormItem name="lastName">
                <FormLabel>{t("profile.lastname")}</FormLabel>
                <FormControl><Input value={form.values.lastName || ''} onChange={e => form.setValues(p => ({ ...p, lastName: e.target.value }))} /></FormControl>
                <FormMessage />
              </FormItem>
            </div>
            <div className={styles.avatarCol}>
              <input type="file" accept="image/*" id="avatarPhotoInput" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              <div className={styles.avatarPreviewWrapper}>
                {form.values.avatarUrl ? (
                  <>
                    <img src={form.values.avatarUrl} alt="Avatar" className={styles.avatarPreview} onClick={triggerAvatarUpload} />
                    <Button variant="destructive" size="icon-sm" type="button" className={styles.removeAvatarBtn} onClick={() => form.setValues((p: any) => ({ ...p, avatarUrl: '' }))}>
                      <X size={14} />
                    </Button>
                  </>
                ) : (
                  <div className={styles.avatarPlaceholder} onClick={triggerAvatarUpload}>
                    <Camera size={32} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <FormItem name="streetAddress">
            <FormLabel>{t("profile.street")}</FormLabel>
            <FormControl><Input value={form.values.streetAddress || ''} onChange={e => form.setValues(p => ({ ...p, streetAddress: e.target.value }))} /></FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.splitRow}>
            <FormItem name="postcode" className={styles.flex1}>
              <FormLabel>{t("profile.zip")}</FormLabel>
              <FormControl><Input value={form.values.postcode || ''} onChange={e => form.setValues(p => ({ ...p, postcode: e.target.value }))} /></FormControl>
              <FormMessage />
              {billingZoneStatus.type === 'checking' && (
                <div className={styles.deliveryZoneChecking}>{t("profile.postcode_checking")}</div>
              )}
              {billingZoneStatus.type === 'valid' && (
                <div className={styles.deliveryZoneValid}>{t("profile.postcode_valid")}</div>
              )}
              {billingZoneStatus.type === 'inactive' && (
                <div className={styles.deliveryZoneInactive}>{t("register.zone_inactive_1")}</div>
              )}
              {billingZoneStatus.type === 'invalid' && (
                <div className={styles.deliveryZoneInvalid}>{t("profile.postcode_invalid")}</div>
              )}
            </FormItem>
            <FormItem name="city" className={styles.flex2}>
              <FormLabel>{t("profile.city")}</FormLabel>
              <FormControl><Input value={form.values.city || ''} onChange={e => form.setValues(p => ({ ...p, city: e.target.value }))} /></FormControl>
              <FormMessage />
            </FormItem>
          </div>

          <FormItem name="mobileNumber">
            <FormLabel>{t("profile.mobile")}</FormLabel>
            <FormControl><Input value={form.values.mobileNumber || ''} onChange={e => form.setValues(p => ({ ...p, mobileNumber: e.target.value }))} /></FormControl>
            <FormDescription>(zB. +49 170 11 33 55 88)</FormDescription>
            <FormMessage />
          </FormItem>

          <FormItem name="dateOfBirth">
            <FormLabel>{t("profile.dob")}</FormLabel>
            <FormControl><Input type="date" value={form.values.dateOfBirth || ''} onChange={e => form.setValues(p => ({ ...p, dateOfBirth: e.target.value }))} /></FormControl>
            <FormMessage />
          </FormItem>

          <div className={styles.splitRow}>
            <FormItem name="languagePreference" className={styles.flex1}>
              <FormLabel>{t("profile.language")}</FormLabel>
              <Select value={form.values.languagePreference || 'de'} onValueChange={v => form.setValues(p => ({ ...p, languagePreference: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="it">Italiano</SelectItem>
                  <SelectItem value="tr">Türkçe</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
            <FormItem name="notificationPreference" className={styles.flex1}>
              <FormLabel>{t("profile.notifications")}</FormLabel>
              <Select value={form.values.notificationPreference || 'email'} onValueChange={v => form.setValues(p => ({ ...p, notificationPreference: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">{t("profile.notif.email")}</SelectItem>
                  <SelectItem value="sms">{t("profile.notif.sms")}</SelectItem>
                  <SelectItem value="both">{t("profile.notif.both")}</SelectItem>
                </SelectContent>
              </Select>
            </FormItem>
          </div>

          <div className={styles.dropoffSection}>
            <div className={styles.dropoffTextareaCol}>
              <FormItem name="dropoffDescription">
                <FormLabel>{t("profile.dropoff_desc")}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t("profile.dropoff_placeholder")}
                    value={form.values.dropoffDescription || ''}
                    onChange={e => form.setValues((p: any) => ({ ...p, dropoffDescription: e.target.value }))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
              <div style={{ marginTop: 'var(--spacing-2)' }}>
                <input type="file" accept="image/*" id="dropoffPhotoInput" style={{ display: 'none' }} onChange={handlePhotoUpload} />
                <Button variant="outline" type="button" onClick={() => setShowDropoffInfoDialog(true)}>
                  {t("profile.dropoff_photo")}
                </Button>
              </div>
            </div>
            {form.values.dropoffPhotoUrl && (
              <div className={styles.dropoffPhotoCol}>
                <div className={styles.photoPreviewWrapper}>
                  <img src={form.values.dropoffPhotoUrl} alt="Abstellort" className={styles.dropoffPhoto} />
                  <Button variant="destructive" size="icon-sm" type="button" className={styles.removePhotoBtn} onClick={() => form.setValues((p: any) => ({ ...p, dropoffPhotoUrl: '' }))}>
                    <X size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.deliveryAddressSection}>
            <div className={styles.checkboxRow}>
              <Checkbox
                id="deliveryAddressSameAsBilling"
                checked={form.values.deliveryAddressSameAsBilling}
                onChange={e => form.setValues(p => ({ ...p, deliveryAddressSameAsBilling: e.target.checked }))}
              />
              <label htmlFor="deliveryAddressSameAsBilling" style={{ cursor: "pointer" }}>
                {t("profile.same_as_billing")}
              </label>
            </div>

            {!form.values.deliveryAddressSameAsBilling && (
              <div className={styles.deliveryFields}>
                <h3 className={styles.sectionHeading}>{t("profile.delivery_address")}</h3>
                
                <FormItem name="deliveryCompanyName">
                  <FormLabel>{t("profile.delivery_company_optional")}</FormLabel>
                  <FormControl><Input value={form.values.deliveryCompanyName || ''} onChange={e => form.setValues(p => ({ ...p, deliveryCompanyName: e.target.value }))} /></FormControl>
                  <FormMessage />
                </FormItem>
                
                <div className={styles.splitRow}>
                  <FormItem name="deliveryFirstName" className={styles.flex1}>
                    <FormLabel>{t("profile.firstname")}</FormLabel>
                    <FormControl><Input value={form.values.deliveryFirstName || ''} onChange={e => form.setValues(p => ({ ...p, deliveryFirstName: e.target.value }))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                  <FormItem name="deliveryLastName" className={styles.flex1}>
                    <FormLabel>{t("profile.lastname")}</FormLabel>
                    <FormControl><Input value={form.values.deliveryLastName || ''} onChange={e => form.setValues(p => ({ ...p, deliveryLastName: e.target.value }))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                <FormItem name="deliveryStreet">
                  <FormLabel>{t("profile.street")}</FormLabel>
                  <FormControl><Input value={form.values.deliveryStreet || ''} onChange={e => form.setValues(p => ({ ...p, deliveryStreet: e.target.value }))} /></FormControl>
                  <FormMessage />
                </FormItem>

                <div className={styles.splitRow}>
                  <FormItem name="deliveryPostcode" className={styles.flex1}>
                    <FormLabel>{t("profile.zip")}</FormLabel>
                    <FormControl><Input value={form.values.deliveryPostcode || ''} onChange={e => form.setValues(p => ({ ...p, deliveryPostcode: e.target.value }))} /></FormControl>
                    <FormMessage />
                    {deliveryZoneStatus.type === 'checking' && (
                      <div className={styles.deliveryZoneChecking}>{t("profile.postcode_checking")}</div>
                    )}
                    {deliveryZoneStatus.type === 'valid' && (
                      <div className={styles.deliveryZoneValid}>{t("profile.postcode_valid")}</div>
                    )}
                    {deliveryZoneStatus.type === 'invalid' && (
                      <div className={styles.deliveryZoneInvalid}>{t("profile.postcode_invalid")}</div>
                    )}
                  </FormItem>
                  <FormItem name="deliveryCity" className={styles.flex2}>
                    <FormLabel>{t("profile.city")}</FormLabel>
                    <FormControl><Input value={form.values.deliveryCity || ''} onChange={e => form.setValues(p => ({ ...p, deliveryCity: e.target.value }))} /></FormControl>
                    <FormMessage />
                  </FormItem>
                </div>

                <FormItem name="deliveryMobileNumber">
                  <FormLabel>{t("profile.mobile")}</FormLabel>
                  <FormControl><Input value={form.values.deliveryMobileNumber || ''} onChange={e => form.setValues(p => ({ ...p, deliveryMobileNumber: e.target.value }))} /></FormControl>
                  <FormMessage />
                </FormItem>
              </div>
            )}
          </div>

          <div className={styles.actions}>
            <Button type="submit" disabled={isPending || deliveryZoneStatus.type === "invalid" || billingZoneStatus.type === "invalid"}>{t("profile.save")}</Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive" type="button"><Trash2 size={16} style={{ marginRight: '8px' }} /> {t("profile.delete_account")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("profile.delete_confirm")}</DialogTitle>
                  <DialogDescription>{t("profile.delete_warning")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">{t("profile.cancel")}</Button></DialogClose>
                  <Button variant="destructive" onClick={handleDelete}>{t("profile.delete_yes")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Dialog open={showDropoffInfoDialog} onOpenChange={setShowDropoffInfoDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle style={{ textDecoration: 'underline' }}>{t("profile.info")}</DialogTitle>
                <DialogDescription style={{ fontSize: '1rem', color: 'var(--foreground)' }}>
                  {t("profile.photo_hint")}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" onClick={triggerPhotoUpload}>{t("profile.understood")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </form>
      </Form>
    </div>
  );
};