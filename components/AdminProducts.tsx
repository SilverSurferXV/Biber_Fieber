import React, { useState } from 'react';
import { 
  useAdminProducts, useDeleteAdminProduct,
  useAdminCategories
} from '../helpers/useAdminApi';
import { Button } from './Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './Dialog';
import { toast } from 'sonner';
import { GripVertical, Search } from 'lucide-react';
import { useAdminProductReorder } from '../helpers/useAdminProductReorder';
import { Input } from './Input';
import { AdminProductForm } from './AdminProductForm';
import styles from './AdminViews.module.css';
import localStyles from './AdminProducts.module.css';

export const AdminProducts = () => {
  const { data } = useAdminProducts();
  const products = data?.products;
  const { data: categories } = useAdminCategories();
  const { mutateAsync: del } = useDeleteAdminProduct();
  const { mutateAsync: reorderProducts } = useAdminProductReorder();
  
  const [editingId, setEditingProduct] = useState<number | null | 'new'>(null);
  const [cloneData, setCloneData] = useState<any>(null);
  const [localProducts, setLocalProducts] = React.useState<any[]>(products || []);
  const [draggedId, setDraggedId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    if (products) setLocalProducts(products);
  }, [products]);

  const activeProduct = editingId === 'new' ? (cloneData || {}) : localProducts?.find(p => p.id === editingId);

  const sortedCategories = [...(categories || [])].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  const filteredProducts = React.useMemo(() => {
    if (!searchTerm) return localProducts;
    const lower = searchTerm.toLowerCase();
    return localProducts.filter(p => 
      p.name?.toLowerCase().includes(lower) || 
      p.articleNumber?.toLowerCase().includes(lower)
    );
  }, [localProducts, searchTerm]);

  const unassignedProducts = filteredProducts.filter(p => !categories?.find(c => c.id === p.categoryId));

  const handleDrop = async (e: React.DragEvent, targetId: number, categoryId: number | null) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const categoryProds = localProducts.filter(p => p.categoryId === categoryId).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    const draggedIdx = categoryProds.findIndex(p => p.id === draggedId);
    const targetIdx = categoryProds.findIndex(p => p.id === targetId);

    if (draggedIdx === -1 || targetIdx === -1) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const newOrder = [...categoryProds];
    const [draggedItem] = newOrder.splice(draggedIdx, 1);
    newOrder.splice(targetIdx, 0, draggedItem);

    const updates = newOrder.map((p, idx) => ({ id: p.id, sortOrder: idx + 1 }));

    setLocalProducts(prev => prev.map(p => {
       const update = updates.find(u => u.id === p.id);
       if (update) return { ...p, sortOrder: update.sortOrder };
       return p;
    }));

    setDraggedId(null);
    setDragOverId(null);

    try {
      await reorderProducts({ items: updates });
      toast.success("Reihenfolge gespeichert");
    } catch (err: any) {
      toast.error(err.message || "Fehler beim Speichern der Reihenfolge");
    }
  };

  const renderTable = (productsToRender: any[], categoryId: number | null) => {
    const sortedProducts = [...productsToRender].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead><tr><th>Nr.</th><th>Art. Nr</th><th>Name</th><th>Preis</th><th>Status</th><th>Aktionen</th><th>Pro. Beschr.</th></tr></thead>
        <tbody>
          {sortedProducts.map((p, idx) => (
            <tr 
              key={p.id}
              draggable
              onDragStart={(e) => {
                 setDraggedId(p.id);
                 e.dataTransfer.setData('text/plain', p.id.toString());
                 e.dataTransfer.effectAllowed = 'move';
              }}
              onDragOver={(e) => {
                 e.preventDefault();
                 if (draggedId !== p.id) setDragOverId(p.id);
              }}
              onDrop={(e) => handleDrop(e, p.id, categoryId)}
              onDragEnd={() => { setDraggedId(null); setDragOverId(null); }}
              className={`${draggedId === p.id ? localStyles.dragging : ''} ${dragOverId === p.id ? localStyles.dragOver : ''}`}
            >
              <td>
                <div style={{display: 'flex', alignItems: 'center', gap: 'var(--spacing-2)'}}>
                  <GripVertical size={16} className={localStyles.dragHandle} />
                  {idx + 1}
                </div>
              </td>
              <td>{p.articleNumber}</td>
              <td>{p.name}</td>
              <td>{Number(p.priceNet).toFixed(3)} €</td>
              <td style={{ color: p.active ? 'var(--success)' : 'var(--error)', fontWeight: 600 }}>{p.active ? 'Aktiv' : 'Inaktiv'}</td>
              <td>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                  <Button variant="outline" size="sm" onClick={() => { setCloneData(null); setEditingProduct(p.id); }}>Bearbeiten</Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    const { id, ...rest } = p;
                    setCloneData(rest);
                    setEditingProduct('new');
                  }}>Klonen</Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={async () => {
                      if (window.confirm("Produkt wirklich löschen?")) {
                        try {
                          await del({ id: p.id });
                          toast.success("Produkt gelöscht!");
                        } catch(e: any) {
                          toast.error(e.message);
                        }
                      }
                    }}
                  >
                    Löschen
                  </Button>
                </div>
              </td>
              <td style={{ textAlign: 'center' }}>
                {p.externalUrl ? (
                  <span style={{ color: 'var(--success)', fontWeight: 600 }}>✓</span>
                ) : (
                  <span style={{ color: 'var(--error)', opacity: 0.6 }}>✗</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )};

  return (
    <div className={styles.viewContainer}>
      <h2 style={{ margin: 0, color: 'var(--foreground)' }}>Produkte</h2>

      <div className={localStyles.searchContainer}>
        <Search size={18} className={localStyles.searchIcon} />
        <Input 
          placeholder="Produkte suchen..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          className={localStyles.searchInput}
        />
      </div>

      <div style={{ alignSelf: 'flex-start' }}>
        <Button onClick={() => { setCloneData(null); setEditingProduct('new'); }}>Neues Produkt</Button>
      </div>

      {sortedCategories.map(category => {
        const categoryProducts = filteredProducts.filter(p => p.categoryId === category.id);
        if (categoryProducts.length === 0) return null;
        return (
          <div key={category.id} className={styles.categorySection}>
            <h3 className={styles.categoryTitle}>{category.name}</h3>
            {renderTable(categoryProducts, category.id)}
          </div>
        );
      })}

      {unassignedProducts.length > 0 && (
        <div className={styles.categorySection}>
          <h3 className={styles.categoryTitle}>Ohne Kategorie</h3>
          {renderTable(unassignedProducts, null)}
        </div>
      )}

      {editingId !== null && (
        <Dialog open={true} onOpenChange={() => { setEditingProduct(null); setCloneData(null); }}>
                    <DialogContent onInteractOutside={e => e.preventDefault()}>
            <DialogHeader><DialogTitle>{editingId === 'new' ? (cloneData ? 'Produkt klonen' : 'Neues Produkt') : 'Produkt bearbeiten'}</DialogTitle></DialogHeader>
            <AdminProductForm 
              product={activeProduct} 
              categories={categories}
              onClose={() => { setEditingProduct(null); setCloneData(null); }} 
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
};