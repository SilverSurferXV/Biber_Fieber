import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useCategories, useProducts, useDeliveryZoneCheck, useSettings } from '../helpers/useShopApi';
import { useProfile } from '../helpers/useCustomerApi';
import { useMyRatings } from '../helpers/useMyRatings';
import { useCart, getEffectivePrice, getEffectiveBruttoPrice } from '../helpers/useCart';
import { useTranslation } from '../helpers/useTranslation';
import { useConnectionQuality } from '../helpers/useConnectionQuality';
import { Button } from '../components/Button';
import { Progress } from '../components/Progress';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../components/Dialog';
import { ProductRatingDialog } from '../components/ProductRatingDialog';
import { Skeleton } from '../components/Skeleton';
import { Checkbox } from '../components/Checkbox';
import { Input } from '../components/Input';
import { toast } from 'sonner';
import { Star, Minus, Plus, ShoppingCart, Search, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { resolveFileUrl } from '../helpers/resolveFileUrl';
import styles from './shop.module.css';

function DietaryBadge({ emoji, label }: { emoji: string; label: string }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShowTooltip(true);
    }, 1500);
  };

  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip((prev) => !prev);
  };

  return (
    <div 
      className={styles.dietaryBadgeItem}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
    >
      <span>{emoji}</span>
      {showTooltip && (
        <div className={styles.dietaryTooltip}>
          {label}
        </div>
      )}
    </div>
  );
}

function getCategoryName(
  category: { name: string; nameEn?: string | null; nameEs?: string | null; nameIt?: string | null; nameTr?: string | null },
  lang: string
) {
  const langMap: Record<string, string | null | undefined> = {
    en: category.nameEn,
    es: category.nameEs,
    it: category.nameIt,
    tr: category.nameTr,
  };
  return langMap[lang] || category.name;
}

export default function Shop() {
  const { quality: connectionQuality, preferThumbnails } = useConnectionQuality();
  const { t, lang } = useTranslation();
  const [searchParams] = useSearchParams();
  const modifyOrderId = searchParams.get('modify');
  const navigate = useNavigate();
  const [selectedCat, setSelectedCat] = useState<number | undefined>(undefined);
  const [cartOpen, setCartOpen] = useState(false);
  const [categoriesCollapsed, setCategoriesCollapsed] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    
    if (mediaQuery.matches) {
      setCategoriesCollapsed(false);
      timer = setTimeout(() => {
        setCategoriesCollapsed(true);
      }, 3000);
    } else {
      setCategoriesCollapsed(false);
    }
    
    return () => clearTimeout(timer);
  }, [selectedCat]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilters, setDietaryFilters] = useState({ vegan: false, bio: false, glutenFree: false, vegetarian: false });
  const [filterOpen, setFilterOpen] = useState(false);
  const { data: categories, isLoading: catsLoading } = useCategories();
  const { data: products, isLoading: prodsLoading } = useProducts(selectedCat);
  const { items, addToCart, updateQuantity, getTotal, getItemCount, clearCart } = useCart();
  const hasCartItems = items.length > 0;

  const getImageUrl = (photoUrl: string | null, thumbnailUrl: string | null | undefined): string | null => {
    if (!photoUrl && !thumbnailUrl) return null;
    // On slow connections, always prefer thumbnail
    if (preferThumbnails && thumbnailUrl) return resolveFileUrl(thumbnailUrl);
    // In the grid, always use thumbnail if available
    if (thumbnailUrl) return resolveFileUrl(thumbnailUrl);
    return resolveFileUrl(photoUrl);
  };

  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: myRatings } = useMyRatings();
  const { data: zone, isLoading: zoneLoading } = useDeliveryZoneCheck(profile?.postcode || '');
  const { data: settings } = useSettings();

  const FREE_DELIVERY_THRESHOLD = settings?.freeDeliveryThreshold ?? 25;
  const subtotal = getTotal();
  const effectiveDeliveryFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : (zone?.deliveryFee || 0);
  const total = subtotal + effectiveDeliveryFee;
  const totalTax = items.reduce((acc, item) => {
    const brutto = getEffectiveBruttoPrice(item);
    const net = getEffectivePrice(item);
    return acc + (brutto - net);
  }, 0);

  const amountUntilFree = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeDeliveryProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100);

  // Simplified check. Real logic would parse openingHours.
  const isShopOpen = true; 

  const activeProducts = useMemo(() => {
    let productsList = products?.filter(p => p.active !== false) || [];
    
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      productsList = productsList.filter(p => p.name.toLowerCase().includes(q));
    }
    
    if (dietaryFilters.vegan) productsList = productsList.filter(p => p.isVegan);
    if (dietaryFilters.bio) productsList = productsList.filter(p => p.isBio);
    if (dietaryFilters.glutenFree) productsList = productsList.filter(p => p.isGlutenFree);
    if (dietaryFilters.vegetarian) productsList = productsList.filter(p => p.isVegetarian);

    return productsList;
  }, [products, searchQuery, dietaryFilters]);

  const activeFilterCount = (searchQuery.trim() !== '' ? 1 : 0) + Object.values(dietaryFilters).filter(Boolean).length;

  const groupedProducts = useMemo(() => {
    if (selectedCat !== undefined) {
      return [{
        categoryId: selectedCat,
        categoryName: '',
        categoryPhotoUrl: null,
        products: activeProducts
      }];
    }

    const groups = new Map<number, { categoryId: number; categoryName: string; categoryPhotoUrl: string | null; sortOrder: number; products: typeof activeProducts }>();
    
    activeProducts.forEach(p => {
      const catId = p.categoryId || 0;
      if (!groups.has(catId)) {
        const cat = categories?.find(c => c.id === catId);
        groups.set(catId, {
          categoryId: catId,
          categoryName: cat ? getCategoryName(cat, lang) : (p.categoryName || t('shop.other_category')),
          categoryPhotoUrl: cat?.photoUrl || null,
          sortOrder: cat?.sortOrder ?? 9999,
          products: []
        });
      }
      groups.get(catId)!.products.push(p);
    });

    return Array.from(groups.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  }, [activeProducts, categories, selectedCat, t, lang]);

  return (
    <div className={styles.shopLayout}>
      <div className={styles.mainContent}>
        {modifyOrderId && (
          <div className={styles.modifyBanner}>
            <div className={styles.modifyBannerText}>
              {t('shop.modify_banner')}
            </div>
            <Button variant="outline" size="sm" onClick={() => { clearCart(); navigate('/account?tab=bestellungen'); }}>
              {t('shop.cancel')}
            </Button>
          </div>
        )}
        {!isShopOpen && (
        <div className={styles.closedBanner}>
          {t("shop.closed")}
        </div>
      )}
      
      <div className={`${styles.categoryScrollerWrapper} ${categoriesCollapsed ? styles.categoriesCollapsed : styles.categoriesExpanded}`}>
        <div className={styles.categoryScroller}>
          <button 
            className={`${styles.catBtn} ${selectedCat === undefined ? styles.active : ''}`}
            onClick={() => setSelectedCat(undefined)}
          >
            <div className={styles.catIconWrapper}>
              <span className={styles.catInitial}>Alle</span>
            </div>
            <span className={styles.catName}>{t("shop.all_categories")}</span>
          </button>
          {catsLoading ? Array.from({length: 5}).map((_, i) => (
            <Skeleton key={i} className={styles.catSkeleton} />
          )) : categories?.filter(c => c.active !== false).map(c => {
            const catName = getCategoryName(c, lang);
            return (
            <button 
              key={c.id} 
              className={`${styles.catBtn} ${selectedCat === c.id ? styles.active : ''}`}
              onClick={() => setSelectedCat(c.id)}
            >
              <div className={styles.catIconWrapper}>
                {c.photoUrl ? <img loading="lazy" src={resolveFileUrl(c.photoUrl)} alt={catName} /> : <span className={styles.catInitial}>{catName[0]}</span>}
              </div>
              <span className={styles.catName}>{catName}</span>
            </button>
          )})}
        </div>
        <button 
          className={styles.categoryToggleTab}
          onClick={() => setCategoriesCollapsed(!categoriesCollapsed)}
        >
          <span>{t('shop.categories')}</span>
          {categoriesCollapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      <div className={styles.filterSection}>
        <button 
          className={styles.filterToggleBtn} 
          onClick={() => setFilterOpen(!filterOpen)}
        >
          <div className={styles.filterToggleLeft}>
            <Search size={18} />
            <span>{t('shop.search_filter')}</span>
            {activeFilterCount > 0 && (
              <span className={styles.filterCountBadge}>{activeFilterCount}</span>
            )}
          </div>
          {filterOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
        
        <div className={`${styles.filterPanel} ${filterOpen ? styles.filterPanelOpen : ''}`}>
           <div className={styles.filterPanelContent}>
             <div className={styles.searchInputWrapper}>
               <Search size={16} className={styles.searchIcon} />
               <Input 
                 placeholder={t('shop.search_placeholder')} 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className={styles.searchInput}
               />
               {searchQuery && (
                 <button className={styles.clearSearchBtn} onClick={() => setSearchQuery('')}>
                   <X size={16} />
                 </button>
               )}
             </div>
             
             <div className={styles.dietaryFiltersRow}>
               <label className={styles.dietaryFilterLabel}>
                 <Checkbox 
                   checked={dietaryFilters.vegan} 
                   onChange={(e) => setDietaryFilters(prev => ({...prev, vegan: e.target.checked}))} 
                 />
                 <span>🌱 {t('shop.vegan')}</span>
               </label>
               <label className={styles.dietaryFilterLabel}>
                 <Checkbox 
                   checked={dietaryFilters.bio} 
                   onChange={(e) => setDietaryFilters(prev => ({...prev, bio: e.target.checked}))} 
                 />
                 <span>🌿 {t('shop.bio')}</span>
               </label>
               <label className={styles.dietaryFilterLabel}>
                 <Checkbox 
                   checked={dietaryFilters.glutenFree} 
                   onChange={(e) => setDietaryFilters(prev => ({...prev, glutenFree: e.target.checked}))} 
                 />
                 <span>🌾 {t('shop.gluten_free')}</span>
               </label>
               <label className={styles.dietaryFilterLabel}>
                 <Checkbox 
                   checked={dietaryFilters.vegetarian} 
                   onChange={(e) => setDietaryFilters(prev => ({...prev, vegetarian: e.target.checked}))} 
                 />
                 <span>🥬 {t('shop.vegetarian')}</span>
               </label>
             </div>
           </div>
        </div>
      </div>

      <div className={styles.productGrid}>
        {prodsLoading ? Array.from({length: 8}).map((_, i) => <Skeleton key={i} className={styles.productSkeleton} />) : 
         activeProducts.length === 0 ? (
           <div className={styles.emptyState}>{t("shop.empty_category")}</div>
         ) : groupedProducts.map(group => (
          <React.Fragment key={`group-${group.categoryId}`}>
            {selectedCat === undefined && (
              <h3 className={styles.categoryGroupHeader}>{group.categoryName}</h3>
            )}
            {group.products.map(p => {
              const bruttoPrice = Number(p.priceNet) * (1 + (Number(p.taxRate) || 0) / 100);
          const bruttoPrice2 = p.priceNet2 ? Number(p.priceNet2) * (1 + (Number(p.taxRate) || 0) / 100) : null;
          const bruttoPrice3 = p.priceNet3 ? Number(p.priceNet3) * (1 + (Number(p.taxRate) || 0) / 100) : null;
          const myRating = myRatings?.find(r => r.productId === p.id);
          const hasRated = !!myRating;
          const weightVal = parseFloat((p as any).weight || "0");
          const hasWeight = !isNaN(weightVal) && weightVal > 0;
          const kgPriceBrutto = hasWeight ? (bruttoPrice / weightVal) * 1000 : 0;
          return (
          <div key={p.id} className={styles.productCard}>
            <div className={styles.productImageWrapper}>
              {p.isNew && <div className={styles.newBadge}>{t('shop.new_badge')}</div>}
              {hasWeight && (
                <div className={styles.kgPrice}>
                  {kgPriceBrutto.toFixed(2).replace('.', ',')} € / 1,00 kg
                </div>
              )}
              {(p.isVegan || p.isBio || p.isGlutenFree || p.isVegetarian) && (
                <div className={styles.dietaryBadges}>
                  {p.isVegan && <DietaryBadge emoji="🌱" label={t('shop.vegan')} />}
                  {p.isBio && <DietaryBadge emoji="🌿" label={t('shop.bio')} />}
                  {p.isGlutenFree && <DietaryBadge emoji="🌾" label={t('shop.gluten_free')} />}
                  {p.isVegetarian && <DietaryBadge emoji="🥬" label={t('shop.vegetarian')} />}
                </div>
              )}
              {getImageUrl(p.photoUrl, (p as any).thumbnailUrl) ? <img loading="lazy" decoding="async" fetchPriority="low" src={getImageUrl(p.photoUrl, (p as any).thumbnailUrl)!} alt={p.name} /> : <div className={styles.noImage}>{t("shop.no_image")}</div>}
            </div>
            <div className={styles.productInfo}>
              <h3 className={styles.productName}>{p.name}</h3>
              <p className={styles.articleNumber}>{t("shop.article_no").substring(0,3)}: {p.articleNumber}</p>
              
              <div className={styles.ratingPriceRow}>
                                {p.isNew && (
                  <div className={styles.rating}>
                    <Star size={14} className={styles.starIcon} />
                    <span>{p.averageRating ? p.averageRating.toFixed(1) : ''}</span>
                  </div>
                )}
                <p className={styles.price}>{bruttoPrice.toFixed(2)} €</p>
              </div>

              {(bruttoPrice2 || bruttoPrice3) && (
                <div className={styles.tieredPrices}>
                  <div className={styles.tieredPriceRow}>1 {t("shop.piece")}:  {bruttoPrice.toFixed(2)} €</div>
                  {bruttoPrice2 && <div className={styles.tieredPriceRow}>2 {t("shop.piece")}:  {bruttoPrice2.toFixed(2)} €</div>}
                  {bruttoPrice3 && <div className={styles.tieredPriceRow}>3 {t("shop.piece")}:  {bruttoPrice3.toFixed(2)} €</div>}
                </div>
              )}

              <div className={styles.actions}>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className={styles.detailBtn}>{t("shop.details")}</Button>
                  </DialogTrigger>
                  <DialogContent className={styles.detailDialog} onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                      <DialogTitle>{p.name}</DialogTitle>
                    </DialogHeader>
                    <div className={styles.detailContent}>
                      {p.photoUrl && <img loading="lazy" src={resolveFileUrl(p.photoUrl)} alt={p.name} className={styles.detailImage} />}
                      <div className={styles.detailText}>
                        <p>{p.description || t('shop.no_description')}</p>
                        {p.externalUrl && <a href={p.externalUrl} target="_blank" rel="noreferrer" className={styles.externalLink}>{t("shop.more_info")}<br /><span className={styles.moreInfoHint}>{t('shop.more_info_hint')}</span></a>}
                        <div className={styles.detailMeta}>
                          <p><strong>{t("shop.price_net")}:</strong> {Number(p.priceNet).toFixed(2)} €</p>
                          <p><strong>{t("shop.price_gross")}:</strong> {bruttoPrice.toFixed(2)} €</p>
                          {(bruttoPrice2 || bruttoPrice3) && (
                            <div className={styles.detailTieredPrices}>
                              <p><strong>{t("shop.bulk_prices")}:</strong></p>
                              <ul className={styles.detailTieredList}>
                                <li>1 {t("shop.piece")}:  {bruttoPrice.toFixed(2)} € ({t("shop.price_gross").replace('Preis ', '')})</li>
                                {bruttoPrice2 && <li>2 {t("shop.piece")}:  {bruttoPrice2.toFixed(2)} € ({t("shop.price_gross").replace('Preis ', '')})</li>}
                                {bruttoPrice3 && <li>3 {t("shop.piece")}:  {bruttoPrice3.toFixed(2)} € ({t("shop.price_gross").replace('Preis ', '')})</li>}
                              </ul>
                            </div>
                          )}
                          <p><strong>{t("shop.tax_rate")}:</strong> {p.taxRate || 0}%</p>
                          <p><strong>{t("shop.article_no")}:</strong> {p.articleNumber}</p>
                        </div>
                      </div>
                    </div>
                    <div className={styles.detailFooter}>
                      <Button
                        disabled={!isShopOpen}
                        className={styles.detailCartBtn}
                        onClick={() => {
                          addToCart({
                            productId: p.id,
                            name: p.name,
                            price: Number(p.priceNet),
                            quantity: 1,
                            photoUrl: p.photoUrl,
                            taxRate: Number(p.taxRate) || 0,
                            priceNet2: p.priceNet2 ? Number(p.priceNet2) : null,
                            priceNet3: p.priceNet3 ? Number(p.priceNet3) : null
                          });
                          toast.success(`${p.name} ${t("shop.added_to_cart")}`, { duration: 1500 });
                        }}
                      >
                        <ShoppingCart size={16} />
                        {t('shop.add_to_cart')}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                <ProductRatingDialog 
                  productId={p.id} 
                  productName={p.name}
                  hasRated={hasRated}
                  existingRating={myRating}
                >
                  <Button variant="outline" className={styles.rateBtn} title={hasRated ? t('shop.change_rating') : t('shop.rate')}>
                    <Star size={14} fill={hasRated ? "currentColor" : "none"} />
                  </Button>
                </ProductRatingDialog>

                                <Button 
                  disabled={!isShopOpen}
                  size="sm"
                  className={styles.cartBtn}
                  onClick={() => {
                    addToCart({
                      productId: p.id,
                      name: p.name,
                      price: Number(p.priceNet),
                      quantity: 1,
                      photoUrl: p.photoUrl,
                      taxRate: Number(p.taxRate) || 0,
                      priceNet2: p.priceNet2 ? Number(p.priceNet2) : null,
                      priceNet3: p.priceNet3 ? Number(p.priceNet3) : null
                    });
                    toast.success(`${p.name} ${t("shop.added_to_cart")}`, { duration: 1500 });
                  }}
                >
                  <img loading="lazy" src={resolveFileUrl("https://assets.floot.app/369c3501-fab4-4d1f-9c4f-7e589a5b18c1/6193d263-521e-445b-a095-d347970baea3.png")} alt="Korb" className={styles.cartBtnIcon} />
                </Button>
              </div>
            </div>
          </div>
        )})}
          </React.Fragment>
        ))}
      </div>
      </div>
      
      {hasCartItems && (
        <>
          {!cartOpen && (
            <button className={styles.cartToggleTab} onClick={() => setCartOpen(true)}>
              <ShoppingCart size={20} />
              <span className={styles.cartToggleTabCount}>{getItemCount()}</span>
            </button>
          )}

          {cartOpen && <div className={styles.cartBackdrop} onClick={() => setCartOpen(false)} />}
          
          <aside className={`${styles.cartSidebar} ${cartOpen ? styles.open : ''}`}>
            <div className={styles.cartSidebarHeader}>
          <div className={styles.cartSidebarHeaderTitle}>
            <ShoppingCart size={18} />
            <h3>{t("shop.cart")}</h3>
          </div>
          <button className={styles.closeCartBtn} onClick={() => setCartOpen(false)} title={t("checkout.close")}>
            <Plus size={24} style={{ transform: 'rotate(45deg)' }} />
          </button>
        </div>
        
        <div className={styles.cartItems}>
            {items.map(item => {
              const effPriceBrutto = getEffectiveBruttoPrice(item);
              const basePriceBrutto = item.price * (1 + (item.taxRate || 0) / 100);
              const basePriceBruttoTotal = basePriceBrutto * item.quantity;
              const isDiscounted = effPriceBrutto < basePriceBruttoTotal;
              const saving = basePriceBruttoTotal - effPriceBrutto;
              return (
              <div key={item.productId} className={styles.cartItem}>
                <div className={styles.cartItemHeader}>
                  <span className={styles.cartItemName}>{item.name}</span>
                  <span className={styles.cartItemTotal}>{effPriceBrutto.toFixed(2)} €</span>
                </div>
                {isDiscounted && (item.priceNet2 != null || item.priceNet3 != null) && (
                  <div className={styles.discountNote}>
                    {t("shop.you_save", { amount: saving.toFixed(2) })}
                  </div>
                )}
                <div className={styles.cartItemControls}>
                  <button className={styles.qtyBtn} onClick={() => updateQuantity(item.productId, item.quantity - 1)}><Minus size={12} /></button>
                  <span className={styles.qtyValue}>{item.quantity}</span>
                  <button className={styles.qtyBtn} onClick={() => updateQuantity(item.productId, item.quantity + 1)} disabled={false}><Plus size={12} /></button>
                </div>
              </div>
            )})}
          </div>

          <div className={styles.totalsBox}>
            <div className={styles.totalRow}>
              <span>{t("shop.subtotal")}</span>
              <span>{subtotal.toFixed(2)} €</span>
            </div>
            <div className={styles.totalRow}>
              <span>{t("shop.delivery_fee")}</span>
              {zoneLoading ? <Skeleton style={{ width: '40px' }} /> : (
                effectiveDeliveryFee === 0 && zone ? (
                  <span className={styles.freeDeliveryValue}>
                    <span className={styles.originalFee}>{Number(zone.deliveryFee).toFixed(2)} €</span>
                    {t("shop.free")}
                  </span>
                ) : (
                  <span>{zone ? `${Number(zone.deliveryFee).toFixed(2)} €` : 'N/A'}</span>
                )
              )}
            </div>
            <div className={styles.totalRow}>
              <span>{t("shop.incl_tax")}</span>
              <span>{totalTax.toFixed(2)} €</span>
            </div>
            <div className={`${styles.totalRow} ${styles.finalTotal}`}>
              <span>{t("shop.total")}</span>
              <span>{total.toFixed(2)} €</span>
            </div>
            <div className={styles.freeDeliveryBanner}>
              {subtotal >= FREE_DELIVERY_THRESHOLD ? (
                <span className={styles.freeDeliverySuccess}>✓ {t("shop.free_delivery_msg")}</span>
              ) : (
                <div className={styles.freeDeliveryProgress}>
                  <span className={styles.freeDeliveryHint}>
                    {t("shop.free_delivery_left", { amount: amountUntilFree.toFixed(2).replace('.', ',') })}
                  </span>
                  <Progress value={freeDeliveryProgress} className={styles.freeDeliveryBar} />
                </div>
              )}
            </div>
          </div>
          
            <Button asChild className={styles.checkoutBtn}>
              <Link to={modifyOrderId ? `/checkout?modify=${modifyOrderId}` : '/checkout'}>
                {modifyOrderId ? t('shop.update_order') : t("shop.to_checkout")} ({getItemCount()})
              </Link>
            </Button>
          </aside>
        </>
      )}
    </div>
  );
}