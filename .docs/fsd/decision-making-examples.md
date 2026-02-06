## Stores vs Composables

### When to Use Store (Pinia)

**Use Store for:**
- ✅ Global state shared across app
- ✅ Data that persists across navigation
- ✅ Single source of truth
- ✅ Data synced with backend

**Store Location in FSD:**
```
entities/*/model/*Store.ts      ← Entity data
features/*/model/*Store.ts      ← Feature state (if persisted)
shared/model/stores/*Store.ts   ← Global state (auth, theme)
```

**Example**:
```typescript
// entities/cart/model/cartStore.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])  // ← Shared globally
  
  async function addItem(productId: string, quantity: number) {
    // Add to cart
    await $fetch('/api/cart', {
      method: 'POST',
      body: { productId, quantity }
    })
  }
  
  return { items: readonly(items), addItem }
})
```

---

### When to Use Composable

**Use Composable for:**
- ✅ Reusable logic
- ✅ Computed values from stores
- ✅ Local component state
- ✅ Utility functions
- ✅ Wrapper around external APIs

**Composable Location in FSD:**
```
entities/*/model/use*.ts        ← Entity logic
features/*/model/use*.ts        ← Feature logic
shared/model/composables/use*.ts ← Generic utilities
```

**Example**:
```typescript
// entities/cart/model/useCartCalculations.ts
export function useCartCalculations() {
  const cartStore = useCartStore()  // ← Uses store
  
  // Local computed (not global state)
  const subtotal = computed(() =>
    cartStore.items.reduce((sum, i) => sum + i.price * i.quantity, 0)
  )
  
  const tax = computed(() => subtotal.value * 0.1)
  const total = computed(() => subtotal.value + tax.value)
  
  return { subtotal, tax, total }
}
```

---

### Decision Matrix

| Need | Store | Composable |
|------|-------|------------|
| Cart items | ✅ | ❌ |
| Cart total calculation | ❌ | ✅ |
| User authentication | ✅ | ❌ |
| Form validation | ❌ | ✅ |
| Product list | ✅ | ❌ |
| Product filtering | ❌ | ✅ |
| Theme preference | ✅ | ❌ |
| Date formatting | ❌ | ✅ |
