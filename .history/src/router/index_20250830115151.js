import { createRouter, createWebHistory } from 'vue-router'
import HomeEnhanced from '../views/HomeEnhanced.vue'

const routes = [
  {
    path: '/',
    name: 'Home',
    component: HomeEnhanced
  },
  {
    path: '/enhanced',
    redirect: '/'
  },
  {
    path: '/:catchAll(.*)',
    redirect: '/'
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
