<script setup lang="ts">
// Redirect to dashboard - feeds are shown there
definePageMeta({
  middleware: 'auth',
})

navigateTo('/')
</script>
