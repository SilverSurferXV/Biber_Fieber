import React, { useState, useMemo } from "react";
import { toast } from "sonner";
import { Copy, Save, X, Calendar, Edit2, Code, Eye, FileText, ArrowLeft } from "lucide-react";
import { Button } from "./Button";
import { Input } from "./Input";
import { Textarea } from "./Textarea";
import { Badge } from "./Badge";
import { Skeleton } from "./Skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";
import { useEmailTemplates, useSaveEmailTemplate } from "../helpers/useEmailTemplatesAdmin";
import type { EmailTemplate } from "../endpoints/admin/email-templates_GET.schema";
import styles from "./AdminEmailTemplates.module.css";

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

// Helper to highlight variables in the preview
const generatePreviewHtml = (html: string, variables: string[]) => {
  let preview = html;
  variables.forEach((v) => {
    const regex = new RegExp(`{{${v}}}`, "g");
    preview = preview.replace(
      regex,
      `<span style="background-color: #6ECFB5; color: #122620; padding: 2px 6px; border-radius: 4px; font-weight: 500; font-family: monospace; font-size: 0.85em;">[${v}]</span>`
    );
  });
  return preview;
};

const TemplateEditor = ({
  template,
  onClose,
}: {
  template: EmailTemplate;
  onClose: () => void;
}) => {
  const [subject, setSubject] = useState(template.subject);
  const [htmlBody, setHtmlBody] = useState(template.htmlBody);
  const saveMutation = useSaveEmailTemplate();

  const handleSave = () => {
    if (!subject.trim()) {
      toast.error("Betreff darf nicht leer sein");
      return;
    }
    if (!htmlBody.trim()) {
      toast.error("HTML Vorlage darf nicht leer sein");
      return;
    }

    saveMutation.mutate(
      { id: template.id, subject, htmlBody },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleCopyVariable = (variable: string) => {
    const textToCopy = `{{${variable}}}`;
    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        toast.success(`Kopiert: ${textToCopy}`);
      })
      .catch(() => {
        toast.error("Fehler beim Kopieren");
      });
  };

  const previewHtml = useMemo(
    () => generatePreviewHtml(htmlBody, template.availableVariables),
    [htmlBody, template.availableVariables]
  );

  return (
    <div className={styles.editorView}>
      <div className={styles.editorHeader}>
        <Button variant="ghost" size="sm" onClick={onClose} className={styles.backButton}>
          <ArrowLeft size={16} /> Zurück zur Übersicht
        </Button>
        <div className={styles.editorTitleRow}>
          <div className={styles.titleContent}>
            <h2>{template.name}</h2>
            {template.description && <p className={styles.description}>{template.description}</p>}
          </div>
          <div className={styles.actionButtons}>
            <Button
              variant="outline"
              onClick={onClose}
              disabled={saveMutation.isPending}
            >
              <X size={16} /> Abbrechen
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save size={16} /> {saveMutation.isPending ? "Speichert..." : "Speichern"}
            </Button>
          </div>
        </div>
      </div>

      <div className={styles.editorContent}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Betreff</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="E-Mail Betreff eingeben..."
            disabled={saveMutation.isPending}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>Verfügbare Variablen</label>
          <p className={styles.helpText}>
            Klicken Sie auf eine Variable, um sie zu kopieren und im Betreff oder Body einzufügen.
          </p>
          <div className={styles.variableGrid}>
            {template.availableVariables.map((v) => (
              <Badge
                key={v}
                variant="outline"
                className={styles.variableBadge}
                onClick={() => handleCopyVariable(v)}
                title="Klicken zum Kopieren"
              >
                {v} <Copy size={12} className={styles.copyIcon} />
              </Badge>
            ))}
            {template.availableVariables.length === 0 && (
              <span className={styles.noVariables}>Keine Variablen für dieses Template verfügbar.</span>
            )}
          </div>
        </div>

        <Tabs defaultValue="editor" className={styles.tabsContainer}>
          <TabsList>
            <TabsTrigger value="editor">
              <Code size={16} style={{ marginRight: 'var(--spacing-2)' }} />
              HTML Editor
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye size={16} style={{ marginRight: 'var(--spacing-2)' }} />
              Live Vorschau
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="editor" className={styles.tabContent}>
            <Textarea
              value={htmlBody}
              onChange={(e) => setHtmlBody(e.target.value)}
              className={styles.htmlTextarea}
              placeholder="<html><body>...</body></html>"
              disabled={saveMutation.isPending}
              spellCheck={false}
            />
          </TabsContent>
          
          <TabsContent value="preview" className={styles.tabContent}>
            <div className={styles.previewWrapper}>
              {/* Note: In a real advanced setup, an iframe might be better to isolate styles, 
                  but securely scoped dangerouslySetInnerHTML works for admin previews */}
              <div
                className={styles.previewIframeSimulation}
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export const AdminEmailTemplates = () => {
  const { data, isLoading, isError, error } = useEmailTemplates();
  const [editingId, setEditingId] = useState<number | null>(null);

  const editingTemplate = useMemo(
    () => data?.templates.find((t) => t.id === editingId),
    [data, editingId]
  );

  if (editingId && editingTemplate) {
    return (
      <TemplateEditor
        template={editingTemplate}
        onClose={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className={styles.viewContainer}>
      <div className={styles.header}>
        <div>
          <h2>E-Mail Vorlagen</h2>
          <p className={styles.subtitle}>
            Verwalten Sie die System-E-Mails, die an Kunden gesendet werden.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className={styles.gridContainer}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <Skeleton style={{ height: "1.5rem", width: "70%", marginBottom: "1rem" }} />
              <Skeleton style={{ height: "1rem", width: "100%", marginBottom: "0.5rem" }} />
              <Skeleton style={{ height: "1rem", width: "80%", marginBottom: "2rem" }} />
              <Skeleton style={{ height: "2.5rem", width: "100%" }} />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className={styles.errorMessage}>
          <p>Fehler beim Laden der Vorlagen:</p>
          <pre>{error instanceof Error ? error.message : "Unbekannter Fehler"}</pre>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          {data?.templates.map((template) => (
            <div key={template.id} className={styles.templateCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardIconWrapper}>
                  <FileText size={20} className={styles.cardIcon} />
                </div>
                <h3>{template.name}</h3>
              </div>
              
              <div className={styles.cardBody}>
                <p className={styles.cardDescription}>
                  {template.description || "Keine Beschreibung verfügbar."}
                </p>
                <div className={styles.metaInfo}>
                  <Calendar size={14} />
                  <span>
                    Letzte Änderung:{" "}
                    {template.updatedAt
                      ? dateFormatter.format(new Date(template.updatedAt))
                      : "Nie"}
                  </span>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <Button
                  variant="secondary"
                  className={styles.editButton}
                  onClick={() => setEditingId(template.id)}
                >
                  <Edit2 size={16} /> Bearbeiten
                </Button>
              </div>
            </div>
          ))}
          {data?.templates.length === 0 && (
            <div className={styles.emptyState}>
              Es wurden keine E-Mail Vorlagen gefunden.
            </div>
          )}
        </div>
      )}
    </div>
  );
};