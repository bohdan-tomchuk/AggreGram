export default defineNuxtRouteMiddleware((to) => {
  const api = useApi();
  const publicRoutes = ['/auth/login', '/auth/register'];

  if (!api.isAuthenticated() && !publicRoutes.includes(to.path)) {
    return navigateTo('/auth/login');
  }

  if (api.isAuthenticated() && publicRoutes.includes(to.path)) {
    return navigateTo('/');
  }
});
