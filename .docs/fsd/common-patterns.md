
## Common Patterns

### Pattern 1: Lazy Loading Features

```typescript
// widgets/product-catalog/ui/ProductCatalog.vue
<script setup lang="ts">
// Lazy load heavy features
const AddToCartButton = defineAsyncComponent(() => 
  import('@/features/add-to-cart/ui/AddToCartButton.vue')
)

const ProductFilters = defineAsyncComponent(() =>
  import('@/features/product-filters/ui/ProductFilters.vue')
)
</script>
```

### Pattern 2: Feature Flags

```typescript
// shared/config/features.ts
export const FEATURES = {
  WISHLIST: true,
  REVIEWS: true,
  RECOMMENDATIONS: false,
  GIFT_CARDS: false
} as const

export function isFeatureEnabled(feature: keyof typeof FEATURES): boolean {
  return FEATURES[feature]
}
```

```vue
<!-- pages/products/[slug].vue -->
<script setup lang="ts">
import { isFeatureEnabled } from '@/shared/config/features'
import { AddToWishlistButton } from '@/features/add-to-wishlist'

const showWishlist = isFeatureEnabled('WISHLIST')
</script>

<template>
  <div>
    <AddToCartButton :product="product" />
    <AddToWishlistButton v-if="showWishlist" :product="product" />
  </div>
</template>
```

### Pattern 3: Cross-Feature Communication

```typescript
// shared/model/composables/useEventBus.ts
import mitt from 'mitt'

type Events = {
  'cart:item-added': { productId: string; quantity: number }
  'user:logged-in': { userId: string }
  'order:placed': { orderId: string }
}

const emitter = mitt<Events>()

export function useEventBus() {
  return {
    emit: emitter.emit,
    on: emitter.on,
    off: emitter.off
  }
}
```

```typescript
// features/add-to-cart/model/useAddToCart.ts
import { useEventBus } from '@/shared/model/composables/useEventBus'

export function useAddToCart() {
  const eventBus = useEventBus()
  
  async function addToCart(productId: string, quantity: number) {
    await cartStore.addItem(productId, quantity)
    
    // Emit event for other features to react
    eventBus.emit('cart:item-added', { productId, quantity })
  }
  
  return { addToCart }
}
```

```typescript
// features/product-recommendations/model/useRecommendations.ts
import { useEventBus } from '@/shared/model/composables/useEventBus'

export function useRecommendations() {
  const eventBus = useEventBus()
  const recommendations = ref<Product[]>([])
  
  onMounted(() => {
    // React to cart events
    eventBus.on('cart:item-added', async ({ productId }) => {
      recommendations.value = await fetchRelatedProducts(productId)
    })
  })
  
  return { recommendations }
}
```

### Pattern 4: Optimistic UI Updates

```typescript
// entities/cart/model/cartStore.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  
  async function addItem(productId: string, quantity: number) {
    // Optimistic update
    const tempItem: CartItem = {
      productId,
      quantity,
      addedAt: new Date(),
      // ... other fields
    }
    items.value.push(tempItem)
    
    try {
      // API call
      const cart = await cartApi.addItem(productId, quantity)
      items.value = cart.items // Replace with server data
    } catch (error) {
      // Rollback on error
      items.value = items.value.filter(i => i !== tempItem)
      throw error
    }
  }
  
  return { items, addItem }
})
```

### Pattern 5: Shared Entity State

```typescript
// entities/product/model/productStore.ts
export const useProductStore = defineStore('product', () => {
  const cache = new Map<string, Product>()
  const products = ref<Product[]>([])
  
  async function fetchProduct(id: string) {
    // Check cache first
    if (cache.has(id)) {
      return cache.get(id)!
    }
    
    const product = await productApi.getById(id)
    cache.set(id, product)
    
    // Also update main list if present
    const index = products.value.findIndex(p => p.id === id)
    if (index !== -1) {
      products.value[index] = product
    }
    
    return product
  }
  
  return { products, fetchProduct }
})
```