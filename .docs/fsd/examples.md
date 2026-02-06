
## Examples

### Complete Feature Example: Add to Cart

#### 1. Entity: Cart

```typescript
// entities/cart/model/types.ts
export interface CartItem {
  productId: string
  productName: string
  price: number
  quantity: number
  addedAt: Date
}

export interface Cart {
  id: string
  userId: string
  items: CartItem[]
  updatedAt: Date
}
```

```typescript
// entities/cart/api/cartApi.ts
export const cartApi = {
  async getCart(): Promise<Cart> {
    return await $fetch('/api/cart')
  },
  
  async addItem(productId: string, quantity: number): Promise<Cart> {
    return await $fetch('/api/cart/items', {
      method: 'POST',
      body: { productId, quantity }
    })
  },
  
  async removeItem(productId: string): Promise<Cart> {
    return await $fetch(`/api/cart/items/${productId}`, {
      method: 'DELETE'
    })
  },
  
  async updateQuantity(productId: string, quantity: number): Promise<Cart> {
    return await $fetch(`/api/cart/items/${productId}`, {
      method: 'PATCH',
      body: { quantity }
    })
  },
  
  async clear(): Promise<void> {
    await $fetch('/api/cart', { method: 'DELETE' })
  }
}
```

```typescript
// entities/cart/model/cartStore.ts
import { defineStore } from 'pinia'
import { cartApi } from '../api/cartApi'
import type { CartItem, Cart } from './types'

export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  const itemCount = computed(() => 
    items.value.reduce((sum, item) => sum + item.quantity, 0)
  )
  
  const isEmpty = computed(() => items.value.length === 0)
  
  async function fetchCart() {
    loading.value = true
    error.value = null
    
    try {
      const cart = await cartApi.getCart()
      items.value = cart.items
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  async function addItem(productId: string, quantity: number = 1) {
    loading.value = true
    error.value = null
    
    try {
      const cart = await cartApi.addItem(productId, quantity)
      items.value = cart.items
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  async function removeItem(productId: string) {
    loading.value = true
    error.value = null
    
    try {
      const cart = await cartApi.removeItem(productId)
      items.value = cart.items
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  async function updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      await removeItem(productId)
      return
    }
    
    loading.value = true
    error.value = null
    
    try {
      const cart = await cartApi.updateQuantity(productId, quantity)
      items.value = cart.items
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  async function clear() {
    loading.value = true
    error.value = null
    
    try {
      await cartApi.clear()
      items.value = []
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  return {
    items: readonly(items),
    loading: readonly(loading),
    error: readonly(error),
    itemCount,
    isEmpty,
    fetchCart,
    addItem,
    removeItem,
    updateQuantity,
    clear
  }
})
```

```typescript
// entities/cart/model/useCartCalculations.ts
import { useCartStore } from './cartStore'
import { useProductStore } from '@/entities/product'

export function useCartCalculations() {
  const cartStore = useCartStore()
  const productStore = useProductStore()
  
  const subtotal = computed(() => {
    return cartStore.items.reduce((sum, item) => {
      const product = productStore.products.find(p => p.id === item.productId)
      if (!product) return sum
      return sum + product.price * item.quantity
    }, 0)
  })
  
  const tax = computed(() => subtotal.value * 0.1)
  
  const shipping = computed(() => {
    if (subtotal.value === 0) return 0
    if (subtotal.value >= 100) return 0
    return 9.99
  })
  
  const total = computed(() => subtotal.value + tax.value + shipping.value)
  
  const savings = computed(() => {
    if (subtotal.value >= 100) return 9.99
    return 0
  })
  
  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }
  
  return {
    subtotal,
    tax,
    shipping,
    total,
    savings,
    formatMoney
  }
}
```

```vue
<!-- entities/cart/ui/CartItem.vue -->
<script setup lang="ts">
import { useCartStore } from '../model/cartStore'
import { useProduct } from '@/entities/product/model/useProduct'
import { Button } from '@/shared/ui'

const props = defineProps<{
  item: CartItem
}>()

const cartStore = useCartStore()
const { product } = useProduct(() => props.item.productId)

async function updateQuantity(newQuantity: number) {
  await cartStore.updateQuantity(props.item.productId, newQuantity)
}

async function remove() {
  await cartStore.removeItem(props.item.productId)
}
</script>

<template>
  <div class="cart-item">
    <img :src="product?.image" :alt="item.productName" />
    
    <div class="cart-item-details">
      <h3>{{ item.productName }}</h3>
      <p class="price">${{ item.price }}</p>
      
      <div class="quantity-controls">
        <button @click="updateQuantity(item.quantity - 1)">-</button>
        <span>{{ item.quantity }}</span>
        <button @click="updateQuantity(item.quantity + 1)">+</button>
      </div>
    </div>
    
    <div class="cart-item-actions">
      <Button variant="danger" size="sm" @click="remove">
        Remove
      </Button>
    </div>
  </div>
</template>
```

#### 2. Feature: Add to Cart

```typescript
// features/add-to-cart/model/useAddToCart.ts
import { useCartStore } from '@/entities/cart'
import { useNotificationStore } from '@/shared/model/stores/notificationStore'
import { useAuthStore } from '@/shared/model/stores/authStore'

export function useAddToCart() {
  const cartStore = useCartStore()
  const notificationStore = useNotificationStore()
  const authStore = useAuthStore()
  
  const loading = ref(false)
  
  async function addToCart(
    productId: string,
    productName: string,
    quantity: number = 1
  ) {
    // Business rule: Must be authenticated
    if (!authStore.isAuthenticated) {
      notificationStore.error('Please login to add items to cart')
      navigateTo('/auth/login')
      return false
    }
    
    loading.value = true
    
    try {
      await cartStore.addItem(productId, quantity)
      
      notificationStore.success(`${productName} added to cart!`)
      
      // Analytics
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          items: [{ id: productId, name: productName, quantity }]
        })
      }
      
      return true
    } catch (error) {
      console.error('Failed to add to cart:', error)
      notificationStore.error('Failed to add item to cart')
      return false
    } finally {
      loading.value = false
    }
  }
  
  return {
    addToCart,
    loading: readonly(loading)
  }
}
```

```vue
<!-- features/add-to-cart/ui/AddToCartButton.vue -->
<script setup lang="ts">
import { useAddToCart } from '../model/useAddToCart'
import { Button } from '@/shared/ui'
import type { Product } from '@/entities/product'

const props = defineProps<{
  product: Product
  quantity?: number
}>()

const { addToCart, loading } = useAddToCart()

async function handleClick() {
  await addToCart(
    props.product.id,
    props.product.name,
    props.quantity ?? 1
  )
}
</script>

<template>
  <Button
    @click="handleClick"
    :disabled="product.stock === 0 || loading"
    :loading="loading"
  >
    <span v-if="product.stock === 0">Out of Stock</span>
    <span v-else-if="loading">Adding...</span>
    <span v-else>Add to Cart</span>
  </Button>
</template>
```

#### 3. Widget: Cart Drawer

```vue
<!-- widgets/cart-drawer/ui/CartDrawer.vue -->
<script setup lang="ts">
import { useCartStore } from '@/entities/cart/model/cartStore'
import { useCartCalculations } from '@/entities/cart/model/useCartCalculations'
import type { CartItem } from '@/entities/cart/model/types'
import { Modal, Button } from '@/shared/ui'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  'update:isOpen': [value: boolean]
}>()

const cartStore = useCartStore()
const { subtotal, tax, shipping, total, formatMoney } = useCartCalculations()

function close() {
  emit('update:isOpen', false)
}

function goToCheckout() {
  close()
  navigateTo('/checkout')
}

onMounted(() => {
  cartStore.fetchCart()
})
</script>

<template>
  <Modal :is-open="isOpen" @close="close" title="Shopping Cart">
    <div v-if="cartStore.isEmpty" class="empty-cart">
      <p>Your cart is empty</p>
      <Button @click="close">Continue Shopping</Button>
    </div>
    
    <div v-else class="cart-content">
      <div class="cart-items">
        <CartItem
          v-for="item in cartStore.items"
          :key="item.productId"
          :item="item"
        />
      </div>
      
      <div class="cart-summary">
        <div class="summary-row">
          <span>Subtotal:</span>
          <span>{{ formatMoney(subtotal) }}</span>
        </div>
        <div class="summary-row">
          <span>Tax:</span>
          <span>{{ formatMoney(tax) }}</span>
        </div>
        <div class="summary-row">
          <span>Shipping:</span>
          <span>{{ formatMoney(shipping) }}</span>
        </div>
        <div class="summary-row total">
          <span><strong>Total:</strong></span>
          <span><strong>{{ formatMoney(total) }}</strong></span>
        </div>
      </div>
      
      <div class="cart-actions">
        <Button variant="secondary" @click="close">
          Continue Shopping
        </Button>
        <Button variant="primary" @click="goToCheckout">
          Checkout
        </Button>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.cart-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.cart-items {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  max-height: 400px;
  overflow-y: auto;
}

.cart-summary {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: #f5f5f5;
  border-radius: 8px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
}

.summary-row.total {
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 2px solid #333;
}

.cart-actions {
  display: flex;
  gap: 1rem;
}

.empty-cart {
  text-align: center;
  padding: 2rem;
}
</style>
```

#### 4. Page Usage

```vue
<!-- pages/products/[slug].vue -->
<script setup lang="ts">
import { useProduct } from '@/entities/product/model/useProduct'
import { useProductStore } from '@/entities/product/model/productStore'
import AddToCartButton from '@/features/add-to-cart/ui/AddToCartButton.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

const productStore = useProductStore()
const { product, formattedPrice, isInStock } = useProduct(slug)

onMounted(async () => {
  await productStore.fetchProduct(slug.value)
})

useSeoMeta({
  title: () => product.value?.name ?? 'Product',
  description: () => product.value?.description
})
</script>

<template>
  <div v-if="product" class="product-page">
    <div class="product-gallery">
      <img :src="product.image" :alt="product.name" />
    </div>
    
    <div class="product-info">
      <h1>{{ product.name }}</h1>
      <p class="price">{{ formattedPrice }}</p>
      <p class="description">{{ product.description }}</p>
      
      <div v-if="isInStock" class="stock-info">
        <span class="in-stock">In Stock</span>
        <span>{{ product.stock }} available</span>
      </div>
      <div v-else class="stock-info">
        <span class="out-of-stock">Out of Stock</span>
      </div>
      
      <AddToCartButton :product="product" />
    </div>
  </div>
</template>
```
