import React, { useState, useEffect, useRef } from 'react';
import { useSonderbereichFiles } from '../helpers/useCustomerApi';
import { useTranslation } from '../helpers/useTranslation';
import { Button } from '../components/Button';
import { Skeleton } from '../components/Skeleton';
import { FileText, Download, ExternalLink, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';
import * as pdfjsLib from 'pdfjs-dist';
import { resolveFileUrl } from '../helpers/resolveFileUrl';
import styles from './sonderbereich.module.css';

function formatFileSize(bytes: string | number | bigint | null | undefined) {
  if (bytes == null) return '';
  const numBytes = Number(bytes);
  if (isNaN(numBytes) || numBytes < 0) return '';
  if (numBytes < 1024) return `${numBytes} B`;
  if (numBytes < 1024 * 1024) return `${(numBytes / 1024).toFixed(1)} KB`;
  return `${(numBytes / (1024 * 1024)).toFixed(1)} MB`;
}

function PdfViewer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    const loadingTask = pdfjsLib.getDocument(url);
    loadingTask.promise.then(doc => {
      setPdf(doc);
    }).catch(err => {
      console.error('Failed to load PDF', err);
    });
    return () => {
      loadingTask.destroy();
    };
  }, [url]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // Subtract some padding to prevent horizontal scroll
        setContainerWidth(entries[0].contentRect.width - 32);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!pdf || !containerWidth) {
    return (
      <div ref={containerRef} className={styles.pdfViewerContainer}>
        <Skeleton style={{ width: '100%', height: '80vh', borderRadius: 'var(--radius-sm)' }} />
      </div>
    );
  }

  const numPages = pdf.numPages;
  const pages = Array.from({ length: numPages }, (_, i) => i + 1);

  return (
    <div ref={containerRef} className={styles.pdfViewerContainer}>
      {pages.map(pageNumber => (
        <PdfPage 
          key={pageNumber} 
          pdf={pdf} 
          pageNumber={pageNumber} 
          containerWidth={containerWidth} 
          numPages={numPages}
        />
      ))}
    </div>
  );
}

function PdfPage({ pdf, pageNumber, containerWidth, numPages }: { pdf: pdfjsLib.PDFDocumentProxy, pageNumber: number, containerWidth: number, numPages: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useTranslation();
  
  useEffect(() => {
    let renderTask: pdfjsLib.RenderTask | null = null;
    let isCancelled = false;

        pdf.getPage(pageNumber).then(page => {
      if (isCancelled) return;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const displayScale = containerWidth / unscaledViewport.width;
      // Render at 4x resolution for sharp text
      const hiResScale = displayScale * 4;
      const viewport = page.getViewport({ scale: hiResScale });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;
      // Scale down the canvas display size so it fits the container
      canvas.style.width = `${containerWidth}px`;
      canvas.style.height = `${(viewport.height / hiResScale) * displayScale}px`;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      
      renderTask = page.render(renderContext);
      renderTask.promise.catch(() => {});
    });

    return () => {
      isCancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNumber, containerWidth]);

  return (
    <div className={styles.pdfPage}>
      <div className={styles.pdfPageLabel}>
        {t("sonderbereich.page_of", { current: pageNumber, total: numPages })}
      </div>
      <canvas ref={canvasRef} className={styles.pdfCanvas} />
    </div>
  );
}

export default function Sonderbereich() {
  const { t } = useTranslation();
  const { data: files, isLoading } = useSonderbereichFiles();
  const [viewingFile, setViewingFile] = useState<{ url: string; title: string } | null>(null);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("sonderbereich.title")}</h1>
        <p className={styles.subtitle}>{t("sonderbereich.subtitle")}</p>
      </div>

      <div className={styles.grid}>
        {isLoading ? Array.from({length: 4}).map((_, i) => (
          <Skeleton key={i} className={styles.skeletonCard} />
        )) : files?.filter(f => f.active).map(file => (
          <div key={file.id} className={styles.card}>
            <div className={styles.iconBox}>
              <FileText size={32} />
            </div>
            <div className={styles.content}>
              <h3 className={styles.fileTitle}>
                {file.title}
                {file.fileSize && (
                  <span className={styles.fileSize}>{formatFileSize(file.fileSize)}</span>
                )}
              </h3>
              {file.description && <p className={styles.fileDesc}>{file.description}</p>}
              <div className={styles.buttonGroup}>
                <Button
                  variant="outline"
                  className={styles.actionBtn}
                  onClick={() => setViewingFile({ url: resolveFileUrl(file.pdfUrl), title: file.title })}
                >
                  <Eye size={16} /> {t("sonderbereich.open")}
                </Button>
                <Button asChild variant="outline" className={styles.actionBtn}>
                  <a href={resolveFileUrl(file.pdfUrl)} target="_blank" rel="noreferrer">
                    <ExternalLink size={16} /> {t("sonderbereich.open_pdf")}
                  </a>
                </Button>
                <Button asChild variant="primary" className={styles.actionBtn}>
                  <a href={resolveFileUrl(file.pdfUrl)} download>
                    <Download size={16} /> {t("sonderbereich.download")}
                  </a>
                </Button>
              </div>
            </div>
          </div>
        ))}
        {files?.filter(f => f.active).length === 0 && (
          <div className={styles.empty}>{t("sonderbereich.empty")}</div>
        )}
      </div>

      <Dialog open={!!viewingFile} onOpenChange={(open) => !open && setViewingFile(null)}>
        <DialogContent
          style={{ width: '90vw', maxWidth: '1200px', height: '90vh', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
        >
          <DialogHeader>
            <DialogTitle>{viewingFile?.title}</DialogTitle>
          </DialogHeader>
          {viewingFile && <PdfViewer url={viewingFile.url} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}