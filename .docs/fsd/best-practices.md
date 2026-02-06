
## Best Practices

### 1. Layer Import Rules

```typescript
// ✅ ALLOWED: Lower layer → Higher layer
// shared → entities → features → widgets → pages

// entities/product/model/productStore.ts
import { apiClient } from '@/shared/api/client'  // ✅ OK

// features/add-to-cart/model/useAddToCart.ts
import { useCartStore } from '@/entities/cart'  // ✅ OK
import { useNotificationStore } from '@/shared/model/stores'  // ✅ OK

// ❌ FORBIDDEN: Higher layer → Lower layer
// shared/lib/utils.ts
import { useProductStore } from '@/entities/product'  // ❌ WRONG!

// ❌ FORBIDDEN: Same level (except through shared)
// features/add-to-cart/model/useAddToCart.ts
import { useApplyCoupon } from '@/features/apply-coupon'  // ❌ WRONG!
```

### 2. Naming Conventions

```typescript
// Stores: *Store
useCartStore
useProductStore
useAuthStore

// Composables: use*
useProduct
useAddToCart
usePagination

// Components: PascalCase
ProductCard.vue
AddToCartButton.vue
Button.vue

// Types: PascalCase
type Product = { ... }
type CartItem = { ... }

// Constants: UPPER_SNAKE_CASE
const MAX_CART_ITEMS = 100
const API_BASE_URL = '...'
```

### 3. Direct Import Pattern

Import directly from source files for clarity and better tree-shaking:

```typescript
// Import directly from source files
import { useProductStore } from '@/entities/product/model/productStore'
import { useProduct } from '@/entities/product/model/useProduct'
import type { Product, ProductFilters } from '@/entities/product/model/types'
```

### 4. State Management

```typescript
// ✅ DO: Readonly state exposure
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  
  return {
    items: readonly(items),  // ✅ Prevents external mutation
    addItem,
    removeItem
  }
})

// ❌ DON'T: Direct state exposure
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  
  return {
    items,  // ❌ Can be mutated from outside
    addItem
  }
})
```

### 5. Composition API (Recommended)

```typescript
// ✅ DO: Use Composition API for stores
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  
  const total = computed(() => 
    items.value.reduce((sum, i) => sum + i.price, 0)
  )
  
  async function addItem(item: CartItem) {
    items.value.push(item)
  }
  
  return { items: readonly(items), total, addItem }
})

// ❌ AVOID: Options API (less flexible with Nuxt 3)
export const useCartStore = defineStore('cart', {
  state: () => ({ items: [] }),
  getters: { total: (state) => state.items.reduce(...) },
  actions: { addItem(item) { this.items.push(item) } }
})
```

### 6. Feature Independence

```typescript
// ✅ DO: Features use entities
// features/add-to-cart/model/useAddToCart.ts
import { useCartStore } from '@/entities/cart'
import { useProductStore } from '@/entities/product'

// ❌ DON'T: Features depend on each other
// features/add-to-cart/model/useAddToCart.ts
import { useApplyCoupon } from '@/features/apply-coupon'  // ❌ Creates coupling
```

### 7. Error Handling

```typescript
// shared/model/composables/useApi.ts
export function useApi<T>(url: string) {
  const data = ref<T | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  async function fetch() {
    loading.value = true
    error.value = null
    
    try {
      data.value = await $fetch<T>(url)
    } catch (e) {
      error.value = e as Error
      console.error(`API Error: ${url}`, e)
    } finally {
      loading.value = false
    }
  }
  
  return { data, loading, error, fetch }
}
```