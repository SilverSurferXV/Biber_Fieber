import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type CartItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  photoUrl: string | null;
  taxRate: number | null;
  priceNet2: number | null;
  priceNet3: number | null;
};

export const getEffectivePrice = (item: CartItem): number => {
  if (item.quantity === 3) {
    return (item.priceNet3 !== null && item.priceNet3 !== undefined) ? item.priceNet3 : item.price * 3;
  }
  if (item.quantity === 2) {
    return (item.priceNet2 !== null && item.priceNet2 !== undefined) ? item.priceNet2 : item.price * 2;
  }
    if (item.quantity > 3) {
    if (item.priceNet3 !== null && item.priceNet3 !== undefined) {
      return (item.priceNet3 / 3) * item.quantity;
    }
    return item.price * item.quantity;
  }
  return item.price;
};

export const getEffectiveBruttoPrice = (item: CartItem): number => {
  return getEffectivePrice(item) * (1 + (item.taxRate || 0) / 100);
};

type CartContextType = {
  items: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  getItemCount: () => number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('biber_cart');
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load cart", e);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      try {
        const itemsToSave = items;
        localStorage.setItem('biber_cart', JSON.stringify(itemsToSave));
      } catch (e) {
        console.error("Failed to save cart to localStorage", e);
      }
    }
  }, [items, loaded]);

  const addToCart = useCallback((item: CartItem) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i => i.productId === item.productId ? {
          ...i,
          quantity: i.quantity + item.quantity,
          priceNet2: item.priceNet2 !== undefined ? item.priceNet2 : i.priceNet2,
          priceNet3: item.priceNet3 !== undefined ? item.priceNet3 : i.priceNet3
        } : i);
      }
      return [...prev, { ...item }];
    });
  }, []);

  const removeFromCart = useCallback((productId: number) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  }, [removeFromCart]);

  const clearCart = useCallback(() => setItems([]), []);

  const getTotal = useCallback(() => items.reduce((acc, item) => acc + getEffectiveBruttoPrice(item), 0), [items]);

  const getItemCount = useCallback(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, getTotal, getItemCount }}>
      {children}
    </CartContext.Provider>
  );
};

const defaultCartContext: CartContextType = {
  items: [],
  addToCart: () => {},
  removeFromCart: () => {},
  updateQuantity: () => {},
  clearCart: () => {},
  getTotal: () => 0,
  getItemCount: () => 0,
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    return defaultCartContext;
  }
  return context;
};