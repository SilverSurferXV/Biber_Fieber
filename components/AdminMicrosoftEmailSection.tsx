import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Check, Trash2, Printer } from 'lucide-react';
import { 
  useMicrosoftStatus, 
  useMicrosoftDisconnect, 
  useMicrosoftEmails, 
  useSendMicrosoftEmail, 
  MICROSOFT_KEYS 
} from '../helpers/useMicrosoftEmail';
import { useMicrosoftMarkRead } from '../helpers/useMicrosoftEmailsQueries';
import { useMicrosoftDeleteEmailMutation, useMicrosoftMarkRepliedMutation } from '../helpers/useMicrosoftEmailMutations';
import { MicrosoftEmailMessage } from '../endpoints/admin/microsoft/emails_GET.schema';
import { schema as sendEmailSchema } from '../endpoints/admin/microsoft/send-email_POST.schema';
import { ConnectMicrosoftButton } from './ConnectMicrosoftButton';
import { Button } from './Button';
import { Skeleton } from './Skeleton';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './Dialog';
import { Form, FormItem, FormLabel, FormControl, FormMessage, useForm } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './Select';
import { useAdminEmailSignatures } from '../helpers/useAdminEmailSignatures';
import styles from './AdminMicrosoftEmailSection.module.css';

const ComposeEmailDialog = ({ initialTo = '', initialSubject = '', onClose, onReplied }: { initialTo?: string, initialSubject?: string, onClose: () => void, onReplied?: () => void }) => {
  const { mutateAsync: sendEmail } = useSendMicrosoftEmail();
  const { data: signatures } = useAdminEmailSignatures();
  const [selectedSignatureId, setSelectedSignatureId] = useState<string>("none");
  
  const form = useForm({
    defaultValues: {
      to: initialTo,
      subject: initialSubject,
      body: ''
    },
    schema: sendEmailSchema
  });

  const onSubmit = async (data: any) => {
    try {
      let finalBody = data.body
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>");

      if (selectedSignatureId !== "none" && signatures) {
        const sig = signatures.find(s => s.id.toString() === selectedSignatureId);
        if (sig) {
          finalBody += "<br><br>--<br>" + sig.content;
        }
      }
      await sendEmail({ ...data, body: finalBody });
      toast.success("E-Mail erfolgreich gesendet!");
      onReplied?.();
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Senden der E-Mail");
    }
  };

  return (
    <Dialog open={true} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={styles.composeDialogContent}>
        <DialogHeader>
          <DialogTitle>{initialTo ? 'Antworten' : 'Neue E-Mail'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className={styles.composeForm}>
            <FormItem name="to">
              <FormLabel>An</FormLabel>
              <FormControl>
                <Input 
                  value={form.values.to} 
                  onChange={e => form.setValues(p => ({...p, to: e.target.value}))}
                  placeholder="Empfänger E-Mail Adresse"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="subject">
              <FormLabel>Betreff</FormLabel>
              <FormControl>
                <Input 
                  value={form.values.subject} 
                  onChange={e => form.setValues(p => ({...p, subject: e.target.value}))}
                  placeholder="Betreff"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
            <FormItem name="body">
              <FormLabel>Nachricht</FormLabel>
              <FormControl>
                <Textarea 
                  value={form.values.body} 
                  onChange={e => form.setValues(p => ({...p, body: e.target.value}))}
                  placeholder="Ihre Nachricht eingeben..."
                  rows={10}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
                        <div className={styles.signatureSection}>
              <label>Signatur</label>
              <Select value={selectedSignatureId} onValueChange={setSelectedSignatureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Signatur wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Keine Signatur</SelectItem>
                  {signatures?.map(sig => (
                    <SelectItem key={sig.id} value={sig.id.toString()}>{sig.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedSignatureId !== "none" && signatures?.find(s => s.id.toString() === selectedSignatureId) && (
                <div 
                  className={styles.signaturePreview} 
                  dangerouslySetInnerHTML={{ __html: signatures.find(s => s.id.toString() === selectedSignatureId)?.content || '' }} 
                />
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={onClose}>Abbrechen</Button>
              <Button type="submit">Senden</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

const extractEmailFromBody = (body: string | undefined): string | null => {
  if (!body) return null;
  const match = body.match(/E-Mail:(?:<\/(?:strong|b|span)>)?\s*([\w.+\-]+@[\w.\-]+\.\w+)/i);
  return match ? match[1] : null;
};

const EmailItem = ({ email, onReply, onMarkRead, onDelete, isDeleting, isReplied }: { email: MicrosoftEmailMessage, onReply: (to: string, subject: string, messageId: string) => void, onMarkRead: (id: string) => void, onDelete: (id: string) => void, isDeleting: boolean, isReplied: boolean }) => {
  const senderName = email.from?.emailAddress.name || 'Unbekannt';
  const senderAddress = email.from?.emailAddress.address || '';
  const replyTo = extractEmailFromBody(email.body?.content) || senderAddress;
  const dateStr = new Date(email.receivedDateTime).toLocaleString('de-DE');

  const handleOpenChange = (open: boolean) => {
    if (open && !email.isRead) {
      onMarkRead(email.id);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${email.subject || 'E-Mail'}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; line-height: 1.5; color: #000; }
            .header { margin-bottom: 20px; padding-bottom: 10px; border-bottom: 1px solid #ccc; }
            .meta { color: #555; font-size: 0.9em; margin-bottom: 5px; }
            pre { white-space: pre-wrap; font-family: inherit; margin: 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>${email.subject || '(Kein Betreff)'}</h2>
            <div class="meta"><strong>Von:</strong> ${senderName} &lt;${senderAddress}&gt;</div>
            <div class="meta"><strong>Datum:</strong> ${dateStr}</div>
          </div>
          <div class="content">
            ${
              email.body?.contentType === 'html' || email.body?.contentType === 'HTML'
                ? email.body.content
                : `<pre>${email.body?.content || ''}</pre>`
            }
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  return (
    <Dialog onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div className={`${styles.emailItem} ${email.isRead ? styles.read : styles.unread}`}>
          <div className={styles.emailItemContent}>
            <div className={styles.emailItemHeader}>
              <div className={styles.emailItemSender}>{senderName} &lt;{senderAddress}&gt;</div>
              <div className={styles.emailItemDate}>{dateStr}</div>
            </div>
            <div className={styles.emailItemSubject}>{email.subject || '(Kein Betreff)'}</div>
            <div className={styles.emailItemPreview}>{email.bodyPreview}</div>
          </div>
          <div className={styles.emailItemActions}>
            {isReplied && (
              <div className={styles.repliedCheck} title="Beantwortet">
                <Check size={36} />
              </div>
            )}
            <button 
              className={styles.deleteButton} 
              onClick={(e) => { e.stopPropagation(); onDelete(email.id); }}
              disabled={isDeleting}
              aria-label="Löschen"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </DialogTrigger>
      
      <DialogContent className={styles.emailDialogContent}>
        <DialogHeader>
          <DialogTitle>{email.subject || '(Kein Betreff)'}</DialogTitle>
          <DialogDescription>
            Von: {senderName} &lt;{senderAddress}&gt;<br/>
            Datum: {dateStr}
          </DialogDescription>
        </DialogHeader>

        <div className={styles.emailDialogActions}>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer size={16} /> Drucken
          </Button>
        </div>
        
        <div className={styles.emailBodyContainer}>
          {email.body?.contentType === 'html' || email.body?.contentType === 'HTML' ? (
            <div dangerouslySetInnerHTML={{ __html: email.body.content }} />
          ) : (
            <pre className={styles.emailBodyText}>{email.body?.content}</pre>
          )}
        </div>
        
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Schließen</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={() => onReply(replyTo, `Re: ${email.subject}`, email.id)}>Antworten</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const EmailInbox = () => {
  const queryClient = useQueryClient();
  const { data: emails, isLoading, isFetching } = useMicrosoftEmails();
  const { mutate: markAsRead } = useMicrosoftMarkRead();
  const { mutateAsync: deleteEmail } = useMicrosoftDeleteEmailMutation();
  const { mutate: markReplied } = useMicrosoftMarkRepliedMutation();
  
  const [composingEmail, setComposingEmail] = useState<{ to?: string, subject?: string, messageId?: string } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [repliedMessageIds, setRepliedMessageIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  
  const PAGE_SIZE = 20;

  const sortedEmails = React.useMemo(() => {
    if (!emails) return [];
    return [...emails].sort((a, b) => {
      const aReplied = a.categories?.includes("Beantwortet") || repliedMessageIds.has(a.id);
      const bReplied = b.categories?.includes("Beantwortet") || repliedMessageIds.has(b.id);
      if (aReplied !== bReplied) return aReplied ? 1 : -1;
      return 0; // keep original order within each group
    });
  }, [emails, repliedMessageIds]);

  // Reset page when refresh is clicked
  const handleRefresh = () => {
    setCurrentPage(1);
    queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.emails() });
  };

  const handleDelete = async (id: string) => {
    try {
      setDeletingIds(prev => new Set(prev).add(id));
      await deleteEmail(id);
      toast.success("E-Mail gelöscht");
    } catch (error: any) {
      toast.error(error.message || "Fehler beim Löschen der E-Mail");
    } finally {
      setDeletingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  React.useEffect(() => {
    if (sortedEmails) {
      const totalPages = Math.ceil(sortedEmails.length / PAGE_SIZE);
      if (currentPage > totalPages && totalPages > 0) {
        setCurrentPage(totalPages);
      }
    }
  }, [sortedEmails, currentPage, PAGE_SIZE]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-2)', marginTop: 'var(--spacing-4)' }}>
        <Skeleton style={{ height: '4rem' }} />
        <Skeleton style={{ height: '4rem' }} />
        <Skeleton style={{ height: '4rem' }} />
      </div>
    );
  }

  return (
    <div className={styles.inboxContainer}>
      <div className={styles.inboxHeader}>
        <h4>Posteingang</h4>
        <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isFetching}
          >
            {isFetching ? "Aktualisieren..." : "Aktualisieren"}
          </Button>
          <Button onClick={() => setComposingEmail({})}>Neue E-Mail</Button>
        </div>
      </div>

      {emails && emails.length > 0 ? (
        <>
          <div className={styles.emailList}>
            {sortedEmails.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map(email => (
              <EmailItem 
                key={email.id} 
                email={email} 
                onReply={(to, subject, messageId) => setComposingEmail({ to, subject, messageId })}
                onMarkRead={(id) => markAsRead(id)}
                onDelete={handleDelete}
                isDeleting={deletingIds.has(email.id)}
                isReplied={email.categories?.includes("Beantwortet") || repliedMessageIds.has(email.id)}
              />
            ))}
          </div>
          {Math.ceil(sortedEmails.length / PAGE_SIZE) > 1 && (
            <div className={styles.pagination}>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Zurück
              </Button>
              <span className={styles.paginationText}>
                Seite {currentPage} von {Math.ceil(sortedEmails.length / PAGE_SIZE)}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedEmails.length / PAGE_SIZE), p + 1))}
                disabled={currentPage === Math.ceil(sortedEmails.length / PAGE_SIZE)}
              >
                Weiter
              </Button>
            </div>
          )}
        </>
      ) : (
        <p className={styles.emptyInbox}>Keine E-Mails im Posteingang gefunden.</p>
      )}

      {composingEmail && (
        <ComposeEmailDialog 
          initialTo={composingEmail.to} 
          initialSubject={composingEmail.subject} 
          onClose={() => setComposingEmail(null)} 
          onReplied={() => {
            if (composingEmail.messageId) {
              setRepliedMessageIds(prev => new Set(prev).add(composingEmail.messageId!));
              markReplied(composingEmail.messageId);
            }
          }}
        />
      )}
    </div>
  );
};

export const AdminMicrosoftEmailSection = () => {
  const { data: status, isLoading: statusLoading } = useMicrosoftStatus();
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useMicrosoftDisconnect();
  const queryClient = useQueryClient();

  const handleDisconnect = async () => {
    try {
      await disconnect({});
      toast.success("Microsoft Konto getrennt.");
    } catch (e: any) {
      toast.error(e.message || "Fehler beim Trennen des Kontos.");
    }
  };

  const handleConnected = () => {
    queryClient.invalidateQueries({ queryKey: MICROSOFT_KEYS.status() });
    toast.success("Microsoft Konto erfolgreich verbunden.");
  };

  return (
    <div className={styles.sectionBox}>
      <div className={styles.sectionHeader}>
        <div>
          <h3>Microsoft E-Mail Integration</h3>
          <p className={styles.description}>
            Verbinden Sie ein Microsoft-Konto, um E-Mails direkt hier zu empfangen, zu lesen und zu beantworten.
          </p>
        </div>
        {status?.connected && (
          <Button variant="destructive" onClick={handleDisconnect} disabled={isDisconnecting}>
            {isDisconnecting ? "Trennen..." : "Trennen"}
          </Button>
        )}
      </div>

      {statusLoading ? (
        <Skeleton style={{ height: '100px', marginTop: 'var(--spacing-4)' }} />
      ) : status?.connected ? (
        <>
          <div className={styles.statusConnected}>
            Verbunden als: <strong>{status.email}</strong>
          </div>
          <EmailInbox />
        </>
      ) : (
        <div className={styles.statusDisconnected}>
          <p>Es ist momentan kein Microsoft-Konto verbunden.</p>
          <ConnectMicrosoftButton feature="mail" onConnected={handleConnected} />
        </div>
      )}
    </div>
  );
};