# Feature-Sliced Design (FSD) for Nuxt 3

## Table of Contents

1. [Introduction](#introduction)
2. [Core Concepts](#core-concepts)
3. [Architecture Overview](#architecture-overview)
4. [Project Structure](#project-structure)
5. [Layer Responsibilities](#layer-responsibilities)
6. [Stores vs Composables](#stores-vs-composables)
7. [Best Practices](#best-practices)
8. [Migration Guide](#migration-guide)
9. [Examples](#examples)
10. [Common Patterns](#common-patterns)
11. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is FSD?

Feature-Sliced Design (FSD) is a modern architectural methodology for frontend applications that organizes code by **features and business logic** rather than technical layers. It provides a scalable, maintainable structure that prevents the common "spaghetti code" problem in large applications.

### Why FSD for Nuxt 3?

- **Scalability**: Easily grows from 10 to 100+ features
- **Team-Friendly**: Multiple developers can work independently
- **Clear Boundaries**: Features are isolated and self-contained
- **Maintainable**: Easy to understand, modify, and test
- **Nuxt-Native**: Works seamlessly with Nuxt 3's auto-imports

### When to Use FSD?

✅ **Use FSD for:**
- Medium to large applications (20+ features)
- SaaS platforms
- E-commerce applications
- Admin panels with multiple modules
- Projects with 3+ developers
- Long-term projects (2+ years)

❌ **Don't use FSD for:**
- Simple landing pages
- Small blogs
- MVPs with < 10 features
- Solo projects with simple requirements

---

## Core Concepts

### 1. Vertical Slicing

Traditional (Horizontal):
```
components/     ← All components mixed
stores/         ← All stores mixed
utils/          ← All utilities mixed
```

FSD (Vertical):
```
features/
  ├── auth/           ← Everything for auth
  ├── cart/           ← Everything for cart
  └── checkout/       ← Everything for checkout
```

### 2. Layer Hierarchy

```
app/          ← Highest: Application initialization
pages/        ← Route pages (thin layer)
widgets/      ← Large composite UI blocks
features/     ← User interactions & business features
entities/     ← Business entities (data models)
shared/       ← Lowest: Reusable infrastructure
```

**Rules:**
- Lower layers can't import from higher layers
- Layers can only import from layers below them
- Same-level imports are forbidden (except through shared)

### 3. Direct Imports

Each slice should be imported directly from its source file:

```typescript
// Import directly from the source file
import { useProductStore } from '@/entities/product/model/productStore'
import { useProduct } from '@/entities/product/model/useProduct'
import type { Product, ProductFilters } from '@/entities/product/model/types'

// Keep internal implementation private
// ❌ Don't export: productStore (internal)
// ❌ Don't export: _validateProduct (private)
```

### 4. Isolation

Features should be independent:
- ✅ Feature A can work without Feature B
- ✅ Removing Feature C doesn't break others
- ✅ Features communicate through entities/shared

---

## Architecture Overview

```
┌─────────────────────────────────────┐
│           app/                      │  ← Initialization, providers
├─────────────────────────────────────┤
│           pages/                    │  ← Routing only
├─────────────────────────────────────┤
│           widgets/                  │  ← Composite blocks
├─────────────────────────────────────┤
│           features/                 │  ← User interactions
├─────────────────────────────────────┤
│           entities/                 │  ← Business entities
├─────────────────────────────────────┤
│           shared/                   │  ← Infrastructure
└─────────────────────────────────────┘
```

---

## Project Structure

### Complete E-commerce Structure

```
nuxt-ecommerce/
├── src/
│   ├── app/
│   │   ├── providers/
│   │   │   └── pinia.ts
│   │   └── styles/
│   │       └── global.css
│   │
│   ├── pages/
│   │   ├── index.vue
│   │   ├── products/
│   │   │   ├── index.vue
│   │   │   └── [slug].vue
│   │   ├── cart.vue
│   │   └── checkout/
│   │       ├── index.vue
│   │       └── success.vue
│   │
│   ├── widgets/
│   │   ├── header/
│   │   │   ├── ui/
│   │   │   │   └── Header.vue
│   │   │   └── model/
│   │   │       └── useHeaderState.ts
│   │   ├── footer/
│   │   └── product-filters/
│   │
│   ├── features/
│   │   ├── add-to-cart/
│   │   │   ├── ui/
│   │   │   │   └── AddToCartButton.vue
│   │   │   └── model/
│   │   │       └── useAddToCart.ts
│   │   │
│   │   ├── product-search/
│   │   │   ├── ui/
│   │   │   │   └── SearchBar.vue
│   │   │   └── model/
│   │   │       └── useProductSearch.ts
│   │   │
│   │   ├── apply-coupon/
│   │   │   ├── ui/
│   │   │   └── model/
│   │   │
│   │   └── user-auth/
│   │       ├── ui/
│   │       │   ├── LoginForm.vue
│   │       │   └── RegisterForm.vue
│   │       └── model/
│   │           └── useAuth.ts
│   │
│   ├── entities/
│   │   ├── product/
│   │   │   ├── ui/
│   │   │   │   ├── ProductCard.vue
│   │   │   │   ├── ProductDetails.vue
│   │   │   │   └── ProductGallery.vue
│   │   │   ├── model/
│   │   │   │   ├── productStore.ts
│   │   │   │   ├── useProduct.ts
│   │   │   │   └── types.ts
│   │   │   └── api/
│   │   │       └── productApi.ts
│   │   │
│   │   ├── cart/
│   │   │   ├── ui/
│   │   │   │   ├── CartItem.vue
│   │   │   │   └── CartSummary.vue
│   │   │   ├── model/
│   │   │   │   ├── cartStore.ts
│   │   │   │   ├── useCartCalculations.ts
│   │   │   │   └── types.ts
│   │   │   └── api/
│   │   │       └── cartApi.ts
│   │   │
│   │   ├── order/
│   │   │   ├── ui/
│   │   │   ├── model/
│   │   │   │   ├── orderStore.ts
│   │   │   │   └── types.ts
│   │   │   └── api/
│   │   │
│   │   └── user/
│   │       ├── ui/
│   │       ├── model/
│   │       │   ├── userStore.ts
│   │       │   └── types.ts
│   │       └── api/
│   │
│   └── shared/
│       ├── ui/
│       │   ├── Button.vue
│       │   ├── Input.vue
│       │   ├── Modal.vue
│       │   ├── Card.vue
│       │   └── Dropdown.vue
│       │
│       ├── model/
│       │   ├── stores/
│       │   │   ├── authStore.ts
│       │   │   ├── notificationStore.ts
│       │   │   └── themeStore.ts
│       │   └── composables/
│       │       ├── useApi.ts
│       │       ├── usePagination.ts
│       │       ├── useDebounce.ts
│       │       └── useModal.ts
│       │
│       ├── lib/
│       │   ├── currency.ts
│       │   ├── date.ts
│       │   └── validators.ts
│       │
│       ├── api/
│       │   └── client.ts
│       │
│       └── config/
│           └── constants.ts
│
├── layouts/
│   ├── default.vue
│   └── checkout.vue
│
├── middleware/
│   └── auth.ts
│
├── public/
├── nuxt.config.ts
├── package.json
└── tsconfig.json
```

---

## Layer Responsibilities

### 1. App Layer (`app/`)

**Purpose**: Application-wide initialization and configuration

**Contains**:
- Providers (Pinia, i18n, etc.)
- Global styles
- Root error handlers
- App-level middleware

**Example**:
```typescript
// app/providers/pinia.ts
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate'

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia()
  pinia.use(piniaPluginPersistedstate)
  nuxtApp.vueApp.use(pinia)
})
```

---

### 2. Pages Layer (`pages/`)

**Purpose**: Route definitions (thin layer - routing only!)

**Rules**:
- ✅ Define routes
- ✅ Import widgets/features
- ✅ Basic SEO meta
- ❌ No business logic
- ❌ No data fetching (use composables)
- ❌ Minimal markup

**Example**:
```vue
<!-- pages/products/[slug].vue -->
<script setup lang="ts">
import { ProductDetailsWidget } from '@/widgets/product-details'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// SEO
definePageMeta({
  layout: 'default'
})

useSeoMeta({
  title: 'Product Details'
})
</script>

<template>
  <div>
    <ProductDetailsWidget :slug="slug" />
  </div>
</template>
```

---

### 3. Widgets Layer (`widgets/`)

**Purpose**: Large composite UI blocks that combine multiple features/entities

**Characteristics**:
- Compose features + entities
- Business-aware but not business-logic
- Can have local state (via composables)
- Reusable across pages

**Structure**:
```
widgets/
├── product-catalog/
│   ├── ui/
│   │   └── ProductCatalog.vue
│   └── model/
│       └── useCatalogState.ts
├── header/
└── footer/
```

**Example**:
```vue
<!-- widgets/product-catalog/ui/ProductCatalog.vue -->
<script setup lang="ts">
import { ProductCard } from '@/entities/product'
import { ProductSearch } from '@/features/product-search'
import { ProductFilters } from '@/features/product-filters'
import { useProductStore } from '@/entities/product'
import { useProductFilters } from '@/features/product-filters'

const productStore = useProductStore()
const { filteredProducts } = useProductFilters()

onMounted(() => {
  productStore.fetchProducts()
})
</script>

<template>
  <div class="catalog">
    <ProductSearch />
    <div class="catalog-layout">
      <aside>
        <ProductFilters />
      </aside>
      <main>
        <div class="product-grid">
          <ProductCard 
            v-for="product in filteredProducts"
            :key="product.id"
            :product="product"
          />
        </div>
      </main>
    </div>
  </div>
</template>
```

---

### 4. Features Layer (`features/`)

**Purpose**: User interactions and use cases

**Characteristics**:
- One feature = one user action/scenario
- Uses entities (never other features)
- Contains UI + logic
- Isolated and removable

**Structure**:
```
features/
├── add-to-cart/
│   ├── ui/
│   │   └── AddToCartButton.vue
│   └── model/
│       └── useAddToCart.ts
└── apply-coupon/
    ├── ui/
    │   └── CouponForm.vue
    └── model/
        └── useApplyCoupon.ts
```

**Example**:
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
  
  async function addToCart(productId: string, quantity: number = 1) {
    if (!authStore.isAuthenticated) {
      notificationStore.error('Please login first')
      return false
    }
    
    loading.value = true
    
    try {
      await cartStore.addItem(productId, quantity)
      notificationStore.success('Added to cart!')
      
      // Analytics
      if (window.gtag) {
        window.gtag('event', 'add_to_cart', {
          items: [{ id: productId, quantity }]
        })
      }
      
      return true
    } catch (error) {
      notificationStore.error('Failed to add item')
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

const props = defineProps<{
  productId: string
  disabled?: boolean
}>()

const { addToCart, loading } = useAddToCart()

async function handleClick() {
  await addToCart(props.productId)
}
</script>

<template>
  <Button
    @click="handleClick"
    :disabled="disabled || loading"
    :loading="loading"
  >
    <span v-if="loading">Adding...</span>
    <span v-else>Add to Cart</span>
  </Button>
</template>
```

---

### 5. Entities Layer (`entities/`)

**Purpose**: Business entities (core data models)

**Characteristics**:
- Represent business domain objects
- Contains stores (global state)
- Contains composables (entity-specific logic)
- Contains UI components (entity display)
- No business rules (just CRUD)

**Structure**:
```
entities/
├── product/
│   ├── ui/
│   │   ├── ProductCard.vue
│   │   └── ProductDetails.vue
│   ├── model/
│   │   ├── productStore.ts      ← Store (global state)
│   │   ├── useProduct.ts        ← Composable (logic)
│   │   └── types.ts
│   └── api/
│       ├── productApi.ts        ← API methods (CRUD operations)
│       └── product.repository.ts ← Repository pattern (future)
```

**Repository Pattern** (Architecture Decision):
For frontend API interactions each entity will contain its own repository that:
- Encapsulates all API communication for that entity
- Provides domain-specific methods (e.g., `getProducts()`, `createProduct()`)
- Handles request/response transformations
- Manages entity-specific error handling
- Built on top of `shared/api/useAPI` wrapper

This keeps data access logic colocated with the entity it serves, following FSD's vertical slicing principle.

**Example - Store**:
```typescript
// entities/product/model/productStore.ts
import { defineStore } from 'pinia'
import { productApi } from '../api/productApi'
import type { Product } from './types'

export const useProductStore = defineStore('product', () => {
  const products = ref<Product[]>([])
  const selectedProduct = ref<Product | null>(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  
  async function fetchProducts() {
    loading.value = true
    error.value = null
    
    try {
      products.value = await productApi.getAll()
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  async function fetchProduct(id: string) {
    loading.value = true
    error.value = null
    
    try {
      selectedProduct.value = await productApi.getById(id)
    } catch (e) {
      error.value = e as Error
      throw e
    } finally {
      loading.value = false
    }
  }
  
  function getProductById(id: string): Product | undefined {
    return products.value.find(p => p.id === id)
  }
  
  return {
    products: readonly(products),
    selectedProduct: readonly(selectedProduct),
    loading: readonly(loading),
    error: readonly(error),
    fetchProducts,
    fetchProduct,
    getProductById
  }
})
```

**Example - Composable**:
```typescript
// entities/product/model/useProduct.ts
import { useProductStore } from './productStore'
import type { Product } from './types'

export function useProduct(productId: MaybeRef<string>) {
  const productStore = useProductStore()
  const id = toRef(productId)
  
  const product = computed(() => productStore.getProductById(id.value))
  
  const isInStock = computed(() => (product.value?.stock ?? 0) > 0)
  
  const formattedPrice = computed(() => {
    if (!product.value) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(product.value.price)
  })
  
  async function refresh() {
    if (!id.value) return
    await productStore.fetchProduct(id.value)
  }
  
  return {
    product,
    isInStock,
    formattedPrice,
    refresh
  }
}
```

---

### 6. Shared Layer (`shared/`)

**Purpose**: Reusable infrastructure (no business logic)

**Contains**:
- UI kit (generic components)
- Utilities
- API client
- Types
- Constants
- Generic composables

**Structure**:
```
shared/
├── ui/              ← Generic UI components
├── model/
│   ├── stores/      ← Cross-cutting stores (auth, theme)
│   └── composables/ ← Utility composables
├── lib/             ← Pure functions
├── api/             ← API client
└── config/          ← Constants
```

**Examples**:
```vue
<!-- shared/ui/Button.vue -->
<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'secondary' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>()
</script>

<template>
  <button
    :class="['btn', `btn-${variant}`, `btn-${size}`]"
    :disabled="disabled || loading"
  >
    <span v-if="loading">Loading...</span>
    <slot v-else />
  </button>
</template>
```

```typescript
// shared/model/composables/usePagination.ts
export function usePagination(itemsPerPage: number = 10) {
  const currentPage = ref(1)
  const totalItems = ref(0)
  
  const totalPages = computed(() => 
    Math.ceil(totalItems.value / itemsPerPage)
  )
  
  const offset = computed(() => 
    (currentPage.value - 1) * itemsPerPage
  )
  
  function goToPage(page: number) {
    if (page < 1 || page > totalPages.value) return
    currentPage.value = page
  }
  
  function nextPage() {
    goToPage(currentPage.value + 1)
  }
  
  function prevPage() {
    goToPage(currentPage.value - 1)
  }
  
  function reset() {
    currentPage.value = 1
  }
  
  return {
    currentPage: readonly(currentPage),
    totalItems,
    totalPages,
    offset,
    goToPage,
    nextPage,
    prevPage,
    reset
  }
}
```

```typescript
// shared/lib/currency.ts
export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount)
}

export function parseCurrency(value: string): number {
  return parseFloat(value.replace(/[^0-9.-]+/g, ''))
}
```
---

## Additional Resources

### Official Documentation
- [Feature-Sliced Design](https://feature-sliced.design/)

### Community
- [FSD Discord](https://discord.gg/S8MzWTUsmp)

### Examples
- [FSD Examples Repository](https://github.com/feature-sliced/examples)

---

### Key Takeaways

1. **Vertical slicing** over horizontal layering
2. **Lower layers** can't depend on higher layers
3. **Stores** for global state, **composables** for logic
4. **Direct imports** from source files for clarity
5. **Feature independence** is paramount
6. **Composition API** for all stores and composables