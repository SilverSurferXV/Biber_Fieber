import React, { useState, useRef } from 'react';
import { useAdminEmailSignatures, useSaveAdminEmailSignature, useDeleteAdminEmailSignature } from '../helpers/useAdminEmailSignatures';
import { schema as emailSignatureSchema } from '../endpoints/admin/email-signature/save_POST.schema';
import { useForm, Form, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from './Form';
import { Input } from './Input';
import { Textarea } from './Textarea';
import { Button } from './Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { toast } from 'sonner';
import { Bold, Italic, Link as LinkIcon, MessageCircle, Phone, Minus } from 'lucide-react';
import adminStyles from './AdminViews.module.css';
import styles from './AdminEmailSignatures.module.css';

export const AdminEmailSignatures = () => {
  const { data: signatures } = useAdminEmailSignatures();
  const [editingId, setEditing] = useState<number | null | 'new'>(null);

  const activeObj = editingId === 'new' ? {} : signatures?.find(s => s.id === editingId);

  return (
    <div className={adminStyles.viewContainer}>
      <div className={adminStyles.header}>
        <h2>E-Mail Signaturen</h2>
        <Button onClick={() => setEditing('new')}>Neue Signatur</Button>
      </div>

      <div className={adminStyles.tableWrapper}>
        <table className={adminStyles.table}>
          <thead><tr><th>Bezeichnung</th><th>Aktionen</th></tr></thead>
          <tbody>
            {signatures?.map(s => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><Button variant="outline" size="sm" onClick={() => setEditing(s.id)}>Bearbeiten</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId === 'new' ? 'Neue Signatur' : 'Signatur bearbeiten'}</DialogTitle></DialogHeader>
            <AdminEmailSignatureForm signature={activeObj} onClose={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
};

const AdminEmailSignatureForm = ({ signature, onClose }: { signature: any, onClose: () => void }) => {
  const { mutateAsync: save } = useSaveAdminEmailSignature();
  const { mutateAsync: del } = useDeleteAdminEmailSignature();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const form = useForm({
    defaultValues: {
      id: signature?.id,
      name: signature?.name || '',
      content: signature?.content || '',
    },
    schema: emailSignatureSchema
  });

  const insertText = (before: string, after: string, defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const textToInsert = selectedText || defaultText;
    
    const newContent = textarea.value.substring(0, start) + before + textToInsert + after + textarea.value.substring(end);
    
    form.setValues(p => ({ ...p, content: newContent }));
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + textToInsert.length);
    }, 0);
  };

  const handleBold = () => insertText('<strong>', '</strong>', 'Text');
  
  const handleItalic = () => insertText('<em>', '</em>', 'Text');
  
  const handleLink = () => {
    const url = window.prompt("URL eingeben:", "https://");
    if (url) {
      insertText(`<a href="${url}">`, '</a>', 'Link');
    }
  };
  
  const handleWhatsApp = () => {
    const phone = window.prompt("WhatsApp Nummer eingeben:", "+49");
    if (phone) {
      const text = window.prompt("Link Text:", "WhatsApp Chat");
      if (text) {
        insertText(`<a href="https://wa.me/${phone.replace(/[^0-9+]/g, '')}">`, '</a>', text);
      }
    }
  };
  
  const handlePhone = () => {
    const phone = window.prompt("Telefonnummer eingeben:");
    if (phone) {
      const text = window.prompt("Link Text:", phone);
      if (text) {
        insertText(`<a href="tel:${phone.replace(/[^0-9+]/g, '')}">`, '</a>', text);
      }
    }
  };
  
  const handleLineBreak = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = textarea.value.substring(0, start) + '<br>' + textarea.value.substring(end);
    form.setValues(p => ({ ...p, content: newContent }));
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 4, start + 4);
    }, 0);
  };

  const onSubmit = async (data: any) => {
    try {
      await save(data);
      toast.success("Gespeichert!");
      onClose();
    } catch(e: any) { toast.error(e.message); }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={adminStyles.formGrid}>
        <FormItem name="name">
          <FormLabel>Bezeichnung</FormLabel>
          <FormControl><Input value={form.values.name} onChange={e => form.setValues(p => ({...p, name: e.target.value}))}/></FormControl>
          <FormMessage />
        </FormItem>
        <FormItem name="content">
          <FormLabel>Signaturtext</FormLabel>
          
          <div className={styles.editorContainer}>
            <div className={styles.signatureToolbar}>
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handleBold} title="Fett"><Bold size={16} /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handleItalic} title="Kursiv"><Italic size={16} /></Button>
              <div className={styles.toolbarSeparator} />
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handleLink} title="Link einfügen"><LinkIcon size={16} /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handleWhatsApp} title="WhatsApp Link"><MessageCircle size={16} /></Button>
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handlePhone} title="Telefon Link"><Phone size={16} /></Button>
              <div className={styles.toolbarSeparator} />
              <Button type="button" variant="ghost" size="icon-sm" className={styles.toolbarButton} onClick={handleLineBreak} title="Zeilenumbruch"><Minus size={16} /></Button>
            </div>
            
            <FormControl>
              <Textarea 
                ref={textareaRef}
                rows={6} 
                placeholder={"z.B. Mit freundlichen Grüßen\nIhr Biber Fieber Team"}
                value={form.values.content} 
                onChange={e => form.setValues(p => ({...p, content: e.target.value}))} 
                style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: '-1px' }}
              />
            </FormControl>
          </div>
          <FormDescription>HTML-Formatierung wird unterstützt. Nutzen Sie die Toolbar oben für schnelle Formatierung.</FormDescription>
          <FormMessage />
        </FormItem>
        
        {form.values.content && (
          <div className={styles.previewContainer}>
            <FormLabel>Vorschau:</FormLabel>
            <div 
              className={styles.signaturePreview}
              dangerouslySetInnerHTML={{ __html: form.values.content }}
            />
          </div>
        )}
        
        <div className={adminStyles.formActions}>
          <Button type="submit">Speichern</Button>
          {signature?.id && <Button type="button" variant="destructive" onClick={async () => { if(window.confirm('Wirklich löschen?')){ await del({id: signature.id}); onClose(); } }}>Löschen</Button>}
        </div>
      </form>
    </Form>
  )
};