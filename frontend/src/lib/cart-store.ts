import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/types";

interface CartState {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setItemQuantity: (item: CartItem, quantity: number) => void;
  removeItem: (item: CartItem) => void;
  clearCart: () => void;
}

function getCartItemKey(item: CartItem): string {
  return JSON.stringify([
    item.productId,
    item.size,
    [...(item.toppingIds ?? item.toppings)].sort(),
  ]);
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => {
          const key = getCartItemKey(item);
          const existingItem = state.items.find(
            (cartItem) => getCartItemKey(cartItem) === key,
          );

          if (!existingItem) {
            return {
              items: [
                ...state.items,
                { ...item, itemTotal: item.price * item.quantity },
              ],
            };
          }

          const quantity = existingItem.quantity + item.quantity;
          return {
            items: state.items.map((cartItem) =>
              getCartItemKey(cartItem) === key
                ? { ...cartItem, quantity, itemTotal: cartItem.price * quantity }
                : cartItem,
            ),
          };
        }),
      setItemQuantity: (item, quantity) =>
        set((state) => ({
          items: state.items.map((cartItem) =>
            getCartItemKey(cartItem) === getCartItemKey(item)
              ? {
                  ...cartItem,
                  quantity: Math.max(1, Math.floor(quantity)),
                  itemTotal:
                    cartItem.price * Math.max(1, Math.floor(quantity)),
                }
              : cartItem,
          ),
        })),
      removeItem: (item) =>
        set((state) => ({
          items: state.items.filter(
            (cartItem) => getCartItemKey(cartItem) !== getCartItemKey(item),
          ),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: "brewlite-cart-storage",
    },
  ),
);
